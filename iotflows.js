/**
 * Copyright 2020 IoTFlows Inc. All rights reserved.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable laconsole.w or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * 
 **/


var mqtt = require("mqtt");

class iotflows {
    
    constructor(username, password, willTopic, willPayload) 
    {           
        this.options = {
            clientId: `iotflows-js-username-${username}-${(new Date().getTime())}`,
            username: username,
            password: password, 
            keepalive: 10,
            clean: true,
            reconnectPeriod: 5000,
            rejectUnauthorized: false,
            protocolId: 'MQIsdp',
            protocolVersion: 3 
        }

        if(willTopic && willPayload) {
            this.options.will = {
                topic: willTopic,
                payload: willPayload,
                qos: 2,
                retain: false
            }            
        }
                
        this.client = mqtt.connect('wss://wss.connect.iotflows.com:443/mqtt', this.options)

        this.client.on('connect', function () {
            console.log("Connected to the server.")            
        })

        this.client.on('message', function (topic, message) {  
            // console.log("Received a message:")
            // console.log(message.toString())            
        })
    }

}


module.exports = iotflows




