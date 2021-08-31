import { render } from '@asyncapi/generator-react-sdk';
const _ = require('lodash');

/* 
 * Here you can see example of complex operations. 
 * You can actually do whatever you want. It is important that the value returned from the function must be a string or a component.
 */
export function ListChannels({ channels, operationType = 'publish' }) {
  const namesList = Object.entries(channels)
    .map(([channelName, channel]) => {
      if (
        (operationType === 'publish' && channel.hasPublish()) || 
        (operationType === 'subscribe' && channel.hasSubscribe())
      ) {
        return  `<li><strong>${channelName}</strong></li>`;
      }
    })
    .filter(Boolean);

  return `
<h2>
  Channels that you can ${operationType} to
</h2>
<hr />
<br />
<div class="container mx-auto px-8">
  <ul class="list-disc">${namesList.join('')}</ul>
</div>
`;
}

function pascalCase(string) {
  string = _.camelCase(string);
  return string.charAt(0).toUpperCase() + string.slice(1);
}

let subscriptionFunction = (channelName, operation, message) => `
// subscription handler for ${channelName}        
func ${operation}(msg *message.Message) error {

  log.Printf("received message payload: %s", string(msg.Payload))

  var lm payloads.${message}
  err := json.Unmarshal(msg.Payload, &lm)
  if err != nil {
    fmt.Printf("error unmarshalling message: %s, err is: %s", msg.Payload, err)
    return err
  }

  return nil
}
`;

export function SubscriptionHandlers({ channels }) {
  let m = Object.entries(channels)
  .map(([channelName, channel]) => {
    if ( channel.hasPublish()) {
      let operation = pascalCase(channel.publish().id())
      let message = pascalCase(channel.publish().message(0).payload().$id())
      return  subscriptionFunction(channelName, operation, message);
    }
    return "";
  });
  return m;
}

export function Handlers({ moduleName, channels}) {
  return `
package handlers

import (
  "encoding/json"
  "fmt"
  "github.com/ThreeDotsLabs/watermill/message"
  "${moduleName}/payloads"
  "log"
)
${render(<SubscriptionHandlers channels={channels} />)}
  `
}

let addHandlerFunction = (queue, operation) => `
  r.AddNoPublisherHandler(
    "${operation}",          // handler name, must be unique
    "${queue}", // topic from which we will read events
    s,
    handlers.${operation}, 
  )
`

function RouterRules({ channels }) {
  let m = Object.entries(channels)
  .map(([channelName, channel]) => {
    if ( channel.hasPublish()) {
      let operation = pascalCase(channel.publish().id())
      let queue = channel.bindings().amqp.queue.name
      return  addHandlerFunction(queue, operation);
    }
    return "";
  });
  return m;
}

export function Router({moduleName, channels}) {
  return `
package config

import (
	"github.com/ThreeDotsLabs/watermill"
	"github.com/ThreeDotsLabs/watermill/message"
	"${moduleName}/handlers"
)

func GetRouter() (*message.Router, error){

	logger := watermill.NewStdLogger(false, false)
	router, err := message.NewRouter(message.RouterConfig{}, logger)
	if err != nil {
		return nil, err
	}
	return router, nil
}

func ConfigureAMQPSubscriptionHandlers(r *message.Router, s message.Subscriber) {

${render(<RouterRules channels={channels} />)}

}
  `
}


