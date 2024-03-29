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

var http = require('http');
var express = require("express");
var fs = require("fs");
var fetch = require('node-fetch');
var runtime = require("@node-red/runtime");
const { exec, spawn } = require("child_process");

class iotflows_managed_nodered {
            
    constructor(username, password) 
    {                 
        var self = this; 
        self.username = username;
        self.password = password;
        self.authHeader = {'Authorization': 'Basic ' + Buffer.from(username + ":" + password).toString("base64")}
        self.homeDir = require('os').homedir();
        self.RED = require("node-red");

        // Create the base settings
        self.iotflowsSettings = 
        {    
            uiPort: process.env.PORT || 2020,
            uiHost: "::",
            mqttReconnectTime: 15000,
            serialReconnectTime: 15000,
            debugMaxLength: 1000,
            userDir: __dirname + "/.node-red/",
            functionGlobalContext: {
                os:require('os')                
            },    
            logging: {        
                console: {
                    level: "info",            
                    metrics: false,            
                    audit: false
                }
            },    
            editorTheme: {
                projects: {            
                    enabled: false
                }
            }
        }
        
        // Grab current settings of Node-RED if exists
        if(!fs.existsSync(self.homeDir + "/.node-red"))
        {
            fs.mkdirSync(self.homeDir + "/.node-red");
        }

        try 
        {
            self.currentSettings = require(self.homeDir + "/.node-red/settings.js")  
            try {delete self.currentSettings.adminAuth} catch(e){}
            try {delete self.currentSettings.httpNodeAuth} catch(e){}
            try {delete self.currentSettings.httpStaticAuth} catch(e){}                
        }
        catch(e){}        
    }

    async start()
    {
        try{
            var self = this;
            // Read cloud settings 
            let cloudSettings = {}
            await fetch(`https://api.iotflows.com/v1/devices/${self.username}/nodered/settings`, {
                headers: self.authHeader
            })
            .then(res => res.json())
            .then(json => {                    
                if(json && json.data){
                    cloudSettings = json.data.nodered_settings || {}                
                }else{
                    cloudSettings = {}
                }   
            });     
            
            // Merge settings
            self.mergedSettings = {
                ...self.iotflowsSettings,
                ...self.currentSettings,    
                ...cloudSettings
            };       
            
            // IMPORTANT! COPY this object with no reference
            self.mergedSettings = JSON.parse(JSON.stringify(self.mergedSettings));

            // Make sure Node-RED is not running
            self.bash('sudo systemctl stop nodered.service');
            self.bash('sudo systemctl disable nodered.service');            
            
            self.startServer();    
        }        
        catch(e)
        {
            console.error(e)
        }
    }

    startServer()
    {
        var self = this;

        // Create an Express app
        this.app = express();

        // Add a simple route for static content served from 'public'
        this.app.use("/", express.static("public"));

        // Create a server
        this.server = http.createServer(self.app);
        
        // Initialise the runtime with a server and settings        
        this.RED.init(self.server, self.mergedSettings);

        // Serve the editor UI from /red
        this.app.use(self.mergedSettings.httpAdminRoot, this.RED.httpAdmin);

        // Serve the http nodes UI from /api
        this.app.use(self.mergedSettings.httpNodeRoot, this.RED.httpNode);

        self.server.listen(self.mergedSettings.uiPort);
        // self.server.listen(2020);

        // Start the runtime
        this.RED.start();
    }

    async restart()
    {
        try{
            var self = this;     
                   
            await self.server.close();            
                                    
            await self.RED.stop();
            
            self.start();                                               
        }
        catch(e){
            console.error(e)
        }
        
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

module.exports = iotflows_managed_nodered





