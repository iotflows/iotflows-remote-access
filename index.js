#!/usr/bin/env node
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

"use strict";
const inquirer = require('inquirer')
require('dotenv').config({path: '/etc/iotflows-remote-access/.env'})
var fs = require('fs');
const { exec, spawn } = require("child_process");



// Set new username password for this device
const setCredentials = async () =>
{
    console.log('Please enter the remote access credentials generated in https://console.iotflows.com.')    
    var questions = [{
        type: 'input',
        name: 'username',
        message: "What's the username for this device?",
    },
    {
        type: 'input',
        name: 'password',
        message: "What's the password for this device?",
    }]
    
    let username, password;
    await inquirer.prompt(questions).then(answers => {
        username = answers.username
        password = answers.password
    })    

    process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME = username;
    process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD = password;
    
    try{
        if (!fs.existsSync('/etc/iotflows-remote-access')){
            fs.mkdirSync('/etc/iotflows-remote-access');
        }    
    
        fs.writeFile('/etc/iotflows-remote-access/.env',`IOTFLOWS_REMOTE_ACCESS_USERNAME=${username}\r\nIOTFLOWS_REMOTE_ACCESS_PASSWORD=${password}\r\n`, function (err) {
            if (err) throw err;
            // console.log('Credentials stored.');
        });
    }
    catch(e)
    {
        console.log("Permission not allowed - can't configure the settings.")
    }
    
    
    // console.log('Credentials set.')   
    begin();
}


// Delete credentials
const deleteCredentials = async () =>
{    
    delete process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME
    delete process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD    
}

// Begin the app with an async function
const begin = async () =>
{    
    // Check arguments (delete or set username password if they are passed)
    var args = {}
    process.argv.slice(2).map(eachArg => { args[eachArg.split('=')[0]] = eachArg.split('=')[1] } )
    if(args.command && args.command == 'reset_credentials')
    {
        await deleteCredentials();
    }
    
    if(args.username && args.password)
    {
        console.log("args.username")
        console.log(args.username)
        console.log("args.password")
        console.log(args.password)
        
        process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME = args.username;
        process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD = args.password;        
    }
    
    if( process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME == undefined || process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD == undefined)
    {
        setCredentials(); 
        return;
    }
    else
    {
        let username = process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME
        let password = process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD
        if(username && password)
        {
            var IoTFlowsRemoteAccess = require('./iotflows-remote-access');
            var iotflows_remote_access = new IoTFlowsRemoteAccess(username, password)
            await iotflows_remote_access.retreieveKey();            
            let connect_request = await iotflows_remote_access.connect();
            if(!connect_request)
            {
                setCredentials();
                return
            } 
            else
            {
                // Credentials were correct
                // Update systemd to autorun                                                
                const systemdConfig = 
`[Unit]
Description=Runner for IoTFlows Remote Access
Before=multi-user.target
After=network-online.target
Wants=network-online.target systemd-networkd-wait-online.service

[Service]
User=root
Type=simple
Restart=on-failure
RestartSec=5s
TimeoutSec=5min
IgnoreSIGPIPE=no
KillMode=process
GuessMainPID=no
RemainAfterExit=yes
ExecStart=/usr/bin/env iotflows-remote-access

[Install]
WantedBy=multi-user.target`

                try{
                    if (!fs.existsSync('/etc/systemd')){
                        fs.mkdirSync('/etc/systemd');
                    }
                    if (!fs.existsSync('/etc/systemd/system')){
                        fs.mkdirSync('/etc/systemd/system');
                    }
                    fs.writeFile('/etc/systemd/system/iotflows-remote-access.service', systemdConfig, function (err) {
                        if (err) throw err;
                        bash('sudo systemctl daemon-reload')
                        bash('sudo systemctl enable iotflows-remote-access.service')
                        console.log("Activated systemd to run iotflows-remote-access on boot.")
                    })
                }
                catch(e)
                {
                    console.log("Couldn't set up systemd to run iotflows-remote-access on boot.")
                }                
            }           
        }
        else
        {
            console.log("Bad credentials.")
            setCredentials();
            return
        }            
    }
}

// Execute a bash command
const bash = async (command) =>
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


// Start the program if the internet is connected
console.log('Welcome to IoTFlows Remote Access service.')    

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}  
async function checkInternet() {
    await require('dns').resolve('www.google.com',  async function(err) {
        if (err) {
            console.log("No internet connection. Retrying in 5 seconds.");
             await sleep(5000)
             checkInternet()
        } else {
            internetConnected = true            
            begin()
        }
    });  
}

// ensure internet connectivity
var internetConnected = false
checkInternet()



