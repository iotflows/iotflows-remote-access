#!/usr/bin/env node
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

"use strict";
var IoTFlows = require("./iotflows")
const inquirer = require('inquirer')
const fetch = require('node-fetch');
require('dotenv').config({path: '/etc/iotflows-remote-access/.env'})
var fs = require('fs');
const { exec, spawn } = require("child_process");
const { stringify } = require("querystring");

// DEPRECATED
// We no longer ask user to enter username and password with a prompt
// They should either enter it in the installation, or as arguments, or by QR code from cloud

// Ask user to enter new username password for this device
// const promptUserSetCredentials = async () =>
// {
//     console.log('Please enter the remote access credentials generated in https://console.iotflows.com.')    
//     var questions = [{
//         type: 'input',
//         name: 'username',
//         message: "What's the username for this device?",
//     },
//     {
//         type: 'input',
//         name: 'password',
//         message: "What's the password for this device?",
//     }]
    
//     let username, password;
//     await inquirer.prompt(questions).then(answers => {
//         username = answers.username
//         password = answers.password
//     })    

//     process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME = username;
//     process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD = password;
        
//     begin();
// }

// Verify if device has been assigned
function verifyAssignment() 
{
    return new Promise(resolve => {            

        // if username or password not found, not registered
        if(!process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME || !process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD) resolve(false)
        
        // Auth header
        let authHeader = {'Authorization': 'Basic ' + Buffer.from(process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME + ":" + process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD).toString("base64")}

        // Verify registeration from the cloud
        try 
        {
            fetch(`https://api.iotflows.com/v1/iotflows/device-management/registration/devices/${process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME}/has-been-assigned`, {headers: authHeader})           
            .then(async res => {
                if(res.ok)
                {                    
                    let json = await res.json()                    
                    if(json && json.data && json.data && json.data[0] && json.data[0].assigned)
                    {                        
                        ledCommand('ON')
                        resolve(true)
                    }
                    else 
                    {
                        resolve(false)
                    }
                }
                else{
                    resolve(false)
                }
            })
            .catch(err => {                
                resolve(false)
            })
        } catch(e){console.log(e); resolve(false)}        
    })
}


// Verify if credentials exists and device registered
function verifyRegistration() 
{
    return new Promise(resolve => {                    
        // if username or password not found, not registered
        if(!process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME || !process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD) resolve(false)
        
        // Auth header
        let authHeader = {'Authorization': 'Basic ' + Buffer.from(process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME + ":" + process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD).toString("base64")}
        
        // Verify registeration from the cloud
        try 
        {
            
            fetch(`https://api.iotflows.com/v1/iotflows/device-management/gateways/registration/veritification`, {headers: authHeader})           
            .then(async res => {
                if(res.ok)
                {
                    let json = await res.json()                    
                    if(json && json.data && json.data && json.data.is_registered)
                    {                                                
                        resolve(true)
                    }            
                    else
                    {
                        resolve(false)
                    }
                }
                else{
                    resolve(false)
                }
            })
            .catch(err => {                
                resolve(false)
            })
        } catch(e){console.log(e); resolve(false)}        
    })
}

const connectForRegistration = async (key, password, subscription_topic) =>
{
    var self = this;                                      
    
    // Connect to server
    let iotflows = new IoTFlows(key, password);                                   

    // On Connect
    iotflows.client.on('connect', function () 
    {
        // Subscribe to cloud commands
        iotflows.client.subscribe(subscription_topic, function (err) {             
            if(err) console.log("subscription error", err)            
        })  
        
        console.log('An authorized IoTFlows representative can now register this gateway by signing in IoTFlows app and scanning the QR code.')    
    })               
    
    // On Command received:
    iotflows.client.on('message', async function (topic, message) {   
        let messageJSON = JSON.parse(message.toString())      
        if(messageJSON.device_uuid)
        {
            let device_uuid = messageJSON.device_uuid            
            console.log("Sending registration acknowledgement")
            await acknowledgeRegistration(key, password, device_uuid)
        }
        else if(messageJSON.led_command)
        {
            ledCommand(messageJSON.led_command)                       
        }        
    }) 
    
}


// After receiving the new device_uuid form QR code, acknowledge Registration and if it succeed, store them
const acknowledgeRegistration = async (key, password, device_uuid) =>
{
    // Auth header
    let authHeader = {'Authorization': 'Basic ' + Buffer.from(device_uuid + ":" + password).toString("base64")}

    // Verify registeration from the cloud
    try 
    {
        await fetch(`https://api.iotflows.com/v1/iotflows/device-management/gateways/registration/acknowledgment/from-gateway?key=${key}`, {headers: authHeader})           
        .then(async res => {
            if(res.ok)
            {
                let json = await res.json()
                if(json && json.data && json.data && json.data.is_verified)
                {
                    console.log("New credentials have been verified!")
                    await storeCredentials(device_uuid, password)                    
                }            
            }
            else{                
                console.log("Couldn't send the acknowledgment.")
            }
        })
    } catch(e){console.log(e)}
}

function storeCredentials(username, password)
{
    console.log(`Storing new credentials: ${username} ${password}`)
    return new Promise(async resolve => {           
        try 
        {
            process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME = username
            process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD = password

            // create directory if not exists
            // if (!fs.existsSync('/etc/iotflows-remote-access'))
            //     await bash(`sudo bash -c "sudo mkdir /etc/iotflows-remote-access"`)                
            if (!fs.existsSync('/etc/iotflows-remote-access'))
                fs.mkdirSync('/etc/iotflows-remote-access');
            
            // store (override) credentials
            // await bash(`sudo bash -c 'sudo echo "IOTFLOWS_REMOTE_ACCESS_USERNAME=${username}\r\nIOTFLOWS_REMOTE_ACCESS_PASSWORD=${password}\r\n" > /etc/iotflows-remote-access/.env'`)            
            fs.writeFile('/etc/iotflows-remote-access/.env',`IOTFLOWS_REMOTE_ACCESS_USERNAME=${username}\r\nIOTFLOWS_REMOTE_ACCESS_PASSWORD=${password}\r\n`, function (err) {
                // if (err) throw err;
                // console.log('Credentials stored.');
            });
            resolve()
        }
        catch(e) {
            console.log("Permission not allowed - can't configure the settings.")
        }        
    })
}

const ledCommand = (command) =>
{    
    if(command == 'ON')
    {        
        console.log("Turn LED ON")
        bash(`sudo bash -c "sudo echo none >/sys/class/leds/led0/trigger"`)
        bash(`sudo bash -c "sudo echo 1 >/sys/class/leds/led0/brightness"`)
    }
    else if(command == 'OFF')
    {
        console.log("Turn LED OFF")
        bash(`sudo bash -c "sudo echo none >/sys/class/leds/led0/trigger"`)
        bash(`sudo bash -c "sudo echo 0 >/sys/class/leds/led0/brightness"`)            
    }            
    else if(command == 'HEARTBEAT')
    {
        console.log("Turn LED OFF")
        bash(`sudo bash -c "sudo echo none >/sys/class/leds/led0/trigger"`)
        bash(`sudo bash -c "sudo echo heartbeat >/sys/class/leds/led0/trigger"`)            
    }
    else if(command == 'BLINKSOME')
    {
        console.log("Blinking a few times")

        bash(`sudo bash -c "sudo echo none >/sys/class/leds/led0/trigger"`)
        bash(`sudo bash -c "sudo echo heartbeat >/sys/class/leds/led0/trigger"`)            

        setTimeout( function() {
            bash(`sudo bash -c "sudo echo 0 >/sys/class/leds/led0/brightness"`)            
        }, 5000);                
    }
}

// Request registration from Cloud & QR code
async function requestCloudRegistration()
{
    var self = this
    //{"data":[{"config":{"initial_setup":{"device_uuid":"xxxx","password":"xxx", "subscription_topic": "xxxxx"}}}]}
    try 
    {
        await fetch(`https://api.iotflows.com/v1/iotflows/device-management/gateways/registration/credentials?key=registration-${String(Date.now())}`)           
        .then(async res => {
            if(res.ok)
            {
                let json = await res.json()
                if(json.data && json.data[0] && json.data[0].config && json.data[0].config.initial_setup && json.data[0].config.initial_setup.device_uuid && json.data[0].config.initial_setup.password && json.data[0].config.initial_setup.subscription_topic)    
                {                    
                    let key = json.data[0].config.initial_setup.device_uuid
                    let password = json.data[0].config.initial_setup.password
                    let subscription_topic = json.data[0].config.initial_setup.subscription_topic
                    await connectForRegistration(key, password, subscription_topic)
                }                
                else
                {
                    console.log("Bad data from registration/credentials request.");
                }
            }
            else
            {
                console.log("Bad response code from registration/credentials request.")
            }
        })     
    } catch(e){console.log(e)}
}

// // Delete credentials
// const deleteCredentials = async () =>
// {    
//     delete process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME
//     delete process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD  
//     try{
//         if (!fs.existsSync('/etc/iotflows-remote-access')){
//             fs.mkdirSync('/etc/iotflows-remote-access');
//         }    
    
//         fs.writeFile('/etc/iotflows-remote-access/.env', '', function (err) {
//             if (err) throw err;
//             // console.log('Removed current credentials.');
//         });  
//     }
//     catch(e)
//     {
//         console.log("Permission not allowed - can't delete the settings.")
//     }    
// }

function readArguments()
{    
    // Check arguments (delete or set username password if they are passed)
    return new Promise(async resolve => {       
        var args = {}
        process.argv.slice(2).map(eachArg => { args[eachArg.split('=')[0]] = eachArg.split('=')[1] } )

        // DEPRECATED
        // if(args.command && args.command == 'reset_credentials')
        // {
        //     await deleteCredentials();
        // }
            
        if(args.username && args.password)
        {    
            process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME = args.username;
            process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD = args.password;        
            await storeCredentials(process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME, process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD)
        }

        resolve()
    })
}

// Update systemd to autorun & restart to run as a service
// therefore, if this app crashes, the service will relaunch it
function setupAutoRunAndRestart()
{
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
        
        fs.writeFile('/etc/systemd/system/iotflows-remote-access.service', systemdConfig, async function (err) {
            if (err) throw err;
            bash('sudo systemctl daemon-reload')
            bash('sudo systemctl enable iotflows-remote-access.service')
            console.log("Activated iotflows-remote-access to autorun on reboots and disconnections.")
        })
        
        // if the service is not active, activate it and exit from this installation
        exec('sudo systemctl is-active iotflows-remote-access.service', (error, stdout, stderr) => {                                                
            if(stdout.includes('inactive'))
            {
                // console.log("Installation successful - your device will light up in IoTFlows Console in a moment.")                        
                console.log("Terminating this process and running it as a service.")
                bash('sudo systemctl restart iotflows-remote-access.service')                        
                process.exit(1) 
            }
        });    
                                                    
    }
    catch(e)
    {
        console.log("Couldn't set up systemd to run iotflows-remote-access on boot.")
    } 
}

// Execute a bash command
function bash(command) 
{  
    return new Promise(resolve => {                    
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
            resolve(stdout)
        });    
    })
}

// helper sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}  

//--------------------------------------------------------------------------------------------------
// Verify Internet connection
function verifyInternetConnection() {
    return new Promise(resolve => {        
        require('dns').resolve('api.iotflows.com',  async function(err) {
            if(!err) resolve(true);
            else resolve(false)
        })
    });
}

async function main()
{

    console.log('Welcome to IoTFlows Remote Access service.'); console.log('');

    // read passed arguments    
    await readArguments()
    
    // set up systemd & launch from there
    setupAutoRunAndRestart()

    // verify Internet connection
    console.log("Verifying Internet connectivity...")
    while(!(await verifyInternetConnection())) {console.log("No Internet connection. Verify connection again in 5s."); await sleep(5000)}
    console.log("Done."); console.log("");

    // verify if device is registered
    console.log("Verifying registeration...")
    var hasBeenRegistered = await verifyRegistration()    
    console.log('verifyRegistration')
    console.log(verifyRegistration)

    // if not regietered, try registration it every 60s
    var counter = 0
    while(!hasBeenRegistered)
    {
        if(counter == 0) // every 60s (12x5s attempts), retry registration
        {            
            console.log("Sending a new registration request.")
            await requestCloudRegistration()
        }
        hasBeenRegistered = await verifyRegistration()
        if (!hasBeenRegistered) {await sleep(5000);}        
        if(++counter == 12)
            counter = 0
    }
    console.log("Done."); console.log("");
    

    // verify if device is assigned    
    console.log("Verifying assignment...")
    var hasBeenAssigned = await verifyAssignment()    
    while(!hasBeenAssigned)
    {        
        hasBeenAssigned = await verifyAssignment()
        if (!hasBeenAssigned) {console.log("Verifying assignment again in 10s"); await sleep(10000);}
    }
    console.log("Done."); console.log("");

    // connect the agent to the server
    console.log("Connect to the server.")
    var IoTFlowsRemoteAccess = require('./iotflows-remote-access');
    var iotflows_remote_access = new IoTFlowsRemoteAccess(process.env.IOTFLOWS_REMOTE_ACCESS_USERNAME, process.env.IOTFLOWS_REMOTE_ACCESS_PASSWORD)
    await iotflows_remote_access.retreieveKey();            
    await iotflows_remote_access.connect();

}

// run the main function
main()
