/**
 * Copyright 2019-2022 IoTFlows Inc. All rights reserved.
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
const si = require('systeminformation');
var fs = require('fs');
const Docker = require('dockerode');

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
                    console.log(err)               
                    self.bash('sudo chmod 400 /etc/iotflows-remote-access/.key/.iotflows-remote-access.keyfile')
                });
            })              
            return true;
        }
        catch(e)
        {
            console.log(e)
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

            // Fetch containers list and launch them
            self.spin_up_containers()

            // Start publishing system information
            self.publish_system_information()
            setInterval(function(){ 
                self.publish_system_information()
            }, 60*60*1000);
            

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

                // Is this a containerCommand?
                let container_command = messageJSON.container_command
                let container_id = messageJSON.container_id
                if(container_command)
                {
                    // console.log("CONTAINER COMMAND RECEIVED!!")
                    // console.log(messageJSON)
                    if(container_command == "GET_SYSTEM_INFO")
                    {
                        try{
                            self.publish_system_information()                       
                        }catch(e){console.log(e)}
                        
                    }
                    else if(container_command == "SPIN_UP_CONTAINERS")
                    {
                        try
                        {
                            self.spin_up_containers()
                        }catch(e){console.log(e)}                        
                    }
                    else if(container_command == "CONTAINER_REMOVE" && container_id)
                    {                        
                        try
                        {
                            self.remove_container(container_id)
                        }catch(e){console.log(e)}
                    }
                }
            }
        }) 
        return true;       
    }

    async publish_system_information()
    {
        let self = this;
        let system_information = {}
        try {
            system_information.version = await si.version()
            system_information.time = await si.time()
            system_information.system = await si.system()
            system_information.cpu = await si.cpu()
            system_information.mem = await si.mem()
            system_information.currentLoad = await si.currentLoad()  
            system_information.osInfo = await si.osInfo()
            system_information.networkInterfaces = await si.networkInterfaces()
            system_information.networkInterfaceDefault = await si.networkInterfaceDefault()
            system_information.networkGatewayDefault = await si.networkGatewayDefault()
            system_information.networkStats = await si.networkStats()
            system_information.diskLayout = await si.diskLayout()                    
        }
        catch(err) { console.error(err); };

        try {
            let docker = new Docker();    
            system_information.containers = await docker.listContainers() 
        }
        catch(err) { console.error(err); };
        self.iotflows.client.publish(self.topics.system_information, JSON.stringify({"device_uuid": self.username, "system_information": system_information, "timestamp": Date.now()}))
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

    async spin_up_containers()
    {
        var self = this;
        // invalid password?
        try
        {
            await fetch(`https://api.iotflows.com/v1/devices/${self.username}/containers`, {headers: self.authHeader})        
            .then(res => res.json())
            .then(json => {           
                if(json.data && json.data[0]) 
                {
                    json.data.map(c => {               
                        var environmentVariables = {
                            ...c.container_environment_variables,
                            IOTFLOWS_REMOTE_ACCESS_USERNAME: process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME,
                            IOTFLOWS_REMOTE_ACCESS_PASSWORD: process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD
                        }
                        // self.launch_iotflows_docker_image({imageWithTag:'matteocollina/mosca:latest', killBeforeRun:false, portBindings:[{private_port:'1883', public_port:'1883'}], environmentVariables:{} }) //host.docker.internal IS THE DNS OF THE HOST! Access the broker with this from the container or use the ip of the host
                        // self.launch_iotflows_docker_image({imageWithTag:'iotflows/senseai-fog:latest', killBeforeRun:true, portBindings:[{private_port:'1880', public_port:'1885'}], environmentVariables:{"uuid":"asd"} })                            
                        self.launch_iotflows_docker_image({imageWithTag: c.container_image, killBeforeRun: c.container_kill_before_run, portBindings: c.container_port_bindings, environmentVariables }) //host.docker.internal IS THE DNS OF THE HOST! Access the broker with this from the container or use the ip of the host                        
                    })    
                }                                                
            })                          
        }
        catch(e)
        {
            console.log(e)            
        }          
        self.publish_system_information()
    }

    async launch_iotflows_docker_image({imageWithTag, killBeforeRun, portBindings, environmentVariables})
    {
        var self = this
        var docker = new Docker();

        // authentication
        let auth = {
            key: "ewogICAgICAgICJ1c2VybmFtZSI6ICJpb3RmbG93cyIsCiAgICAgICAgInBhc3N3b3JkIjogImRja3JfcGF0X25Ka2o2WGtCTzUwQVdqM202eWg3YUNranlvVSIsCiAgICAgICAgInNlcnZlcmFkZHJlc3MiOiAiaHR0cHM6Ly9pbmRleC5kb2NrZXIuaW8vdjEiCn0="
        }    

        // environment variables
        var Env = [] // e.g. ["uuid=helloooo"]
        if(environmentVariables)
        {
            Object.keys(environmentVariables).map(key => {
                Env.push(`${key}=${environmentVariables[key]}`)
            })
        }
        
                
        // port bindings
        var ExposedPorts = {}
        var HostConfig = {
            AutoRemove: true, 
            //NetworkMode: 'iotflows-dockers-network',
            PortBindings: {}
        } 
        if(portBindings)
        {
            portBindings.map(p => {
                ExposedPorts[`${p.private_port}/tcp`] = {}
                HostConfig["PortBindings"][`${p.private_port}/tcp`] = [{
                    "HostIP": "0.0.0.0",
                    "HostPort": p.public_port        
                }]    
            })       
        }
        
        
        // create options to create/start containers
        var startOptions = {        
            AttachStdin: false,
            AttachStdout: false,
            AttachStderr: false,
            Tty:true,
            AutoRemove: true,         
            HostConfig, // This is part of createOptions!   .
            ExposedPorts,
            Env, 
        };
            
        // kill the container that's running this image (with any tags), if any
        if(killBeforeRun) await self.stop_container_with_image(imageWithTag, true)
        
        console.log('# Pulling image: ' + imageWithTag)    
        await docker.pull(imageWithTag, {'authconfig': auth}, function(err, stream) {    
            try
            {
                docker.modem.followProgress(stream, onFinished, onProgress);            
            }    
            catch(e)
            {
                console.log("x Error pulling " + imageWithTag)
            }
            function onProgress(event) {
                // console.log('onProgress')
            }
            function onFinished(err, output) {
                console.log(`+ Pull finished, running the container for ${imageWithTag} now...`) 
                try{
                    docker.run(imageWithTag, [], process.stdout, startOptions, function(err, data, container) {
                        console.log('Run executed')
                        console.log(err)
                        console.log(data)
                        // UPDATE STATUS FOR CLOUD
                    }).on('container', function (container) {
                        // console.log('containerDone')
                    })
                }           
                catch(e)
                {
                    console.log(e)
                }
            }         
        });
        
        self.publish_system_information()
    }


    async stop_container_with_image(imageWithTag, deleteAllTags)
    {    
        var self = this

        return new Promise(async resolve => {                   
            var docker = new Docker();    
            let containers = await docker.listContainers()       
            
            

            for (let containerInfo of containers)
            {      
                if(deleteAllTags)
                {                    
                    // remove all tags of this image
                    if(imageWithTag.includes(':'))
                    {
                        imageWithTag = imageWithTag.split(':')[0]
                    }
                    if(containerInfo.Image.startsWith(imageWithTag)) // remove all tags of this image
                    {
                        let container = await docker.getContainer(containerInfo.Id)      
                        try { await container.kill(); } catch(e){}
                        try { await container.remove(); } catch(e){}                        
                        console.log('Killed & deleted all images of ' + imageWithTag)
                    }                
                }
                else
                {
                    if(containerInfo.Image == imageWithTag)                     
                    {
                        let container = await docker.getContainer(containerInfo.Id)      
                        try { await container.kill(); } catch(e){}
                        try { await container.remove(); } catch(e){}                        
                        console.log('Killed & deleted the last ' + imageWithTag)
                    }                
                }                
            }
            self.publish_system_information()
            resolve(true)        
        })    
    }


    async remove_container(containerId)
    {    
        // console.log("Removing: " + containerId)
        var self = this

        return new Promise(async resolve => {                   
            var docker = new Docker();    
            
            try 
            { 
                let container = await docker.getContainer(containerId)      
                await container.kill()
                await container.remove(); 
            } 
            catch(e){console.log(e)}                        
            
            console.log('Killed & removed the last container ' + containerId)            
            self.publish_system_information()
            resolve(true)        
        })    
    }
 
}

module.exports = iotflows_remote_access






