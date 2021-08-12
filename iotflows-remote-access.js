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

var IoTFlows = require("./iotflows")
var IoTFlowsManagedNodeRED = require("./iotflows-managed-nodered")
const fetch = require('node-fetch');
var fs = require('fs');

const { exec, spawn } = require("child_process");

class iotflows_remote_access {
        
    constructor(username, password) 
    {                  
        this.username = username; 
        this.password = password;
        this.authHeader = {'Authorization': 'Basic ' + Buffer.from(username + ":" + password).toString("base64")}
        this.homeDir = require('os').homedir();                
        // console.log(process.platform)// darwin: MacOS, linux: Linux, win32: Windows                       
    }

    async retreieveKey()
    {
        var self = this;
        // invalid password?
        try
        {
            await fetch(`https://api.iotflows.com/v1/device_management/devices/${self.username}/key`, {headers: self.authHeader})        
            .then(res => res.json())
            .then(json => {            
                var key = json.data.key
                if (!fs.existsSync('/etc/iotflows-remote-access')){
                    fs.mkdirSync('/etc/iotflows-remote-access');
                }
                if (!fs.existsSync('/etc/iotflows-remote-access/.key')){
                    fs.mkdirSync('/etc/iotflows-remote-access/.key');
                }
                fs.writeFile('/etc/iotflows-remote-access/.key/.iotflows-remote-access.keyfile', key, function (err) {
                if (err) throw err;                
                self.bash('sudo chmod 400 /etc/iotflows-remote-access/.key/.iotflows-remote-access.keyfile')
                });
            })              
            return true;
        }
        catch(e)
        {
            console.log("Wrong credentials.")
            return false;
        }
                
    }
    
    async connect()
    {
        var self = this;                                      
        
        // retrieve the topics and start the device management service
        await fetch(`https://api.iotflows.com/v1/device_management/devices/${self.username}/topics`, {headers: self.authHeader})
        .then(res => res.json())
        .then(json => self.topics = json.data)            
        .catch(e => console.log('Error ' + e));

        // invalid password?
        if(!self.topics)
        {
            // console.log("Wrong credentials.")
            return false;
        }
                
        // Connect to server
        self.iotflows = new IoTFlows(
            self.username, 
            self.password, 
            // Will message
            self.topics.will_topic, 
            JSON.stringify({"device_uuid": self.username, "online": false, "timestamp": Date.now()}) );                                   

        // On Connect
        this.iotflows.client.on('connect', function () {

            // Send birth message                                                
            self.iotflows.client.publish(self.topics.birth_topic, JSON.stringify({"device_uuid": self.username, "online": true, "timestamp": Date.now()}))                            

            // Subscribe to cloud commands
            self.iotflows.client.subscribe(self.topics.subscribing_topic, function (err) {             
                if(err) {                    
                    console.log("Make sure you are using the right credentials.")
                }
                else {
                    // start the nodered server
                    self.iotflows_managed_nodered = new IoTFlowsManagedNodeRED(self.username, self.password)
                    self.iotflows_managed_nodered.start();
                }
            })
        })                
        
        // On Command received:
        this.iotflows.client.on('message', function (topic, message) {   
            let messageJSON = JSON.parse(message.toString())      
            messageJSON.device_uuid = self.username           

            // Is this a command?
            let command = messageJSON.command;
            if(command)
            {                
                command = Buffer.from(command, 'base64').toString('ascii')                
                if(command)
                {                                                            
                    try
                    {
                        // execute the command
                        self.bash(command);    
                        // respond back success message                    
                        let payload = JSON.stringify({
                            "device_uuid": self.username, 
                            "req": messageJSON, 
                            "res": 
                            {
                                "message": "ok"
                            },
                            "timestamp": Date.now()})
                        self.iotflows.client.publish(self.topics.command_response, payload);                                                                            
                    }
                    catch(e)
                    {
                        // console.log(e)
                    }                    
                }
            }
            else
            {
                // Is this a noderedCommand?
                let nodered_command = messageJSON.nodered_command;
                if(nodered_command)
                {
                    if(nodered_command == "RESTART")
                    {                        
                        self.iotflows_managed_nodered.restart()
                    }
                }
            }
        }) 
        return true;       
    }

    // Execute a bash command
    bash(command) 
    {        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                // console.log(`error: ${error.message}`); 
                return;
            }
            if (stderr) {
                // console.log(`stderr: ${stderr}`);
                return;
            }
            // console.log(`stdout: ${stdout}`);
        });    
    }
}

module.exports = iotflows_remote_access










        