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
require('dotenv').config()
var fs = require('fs');


// Set new username password for this device
const setCredentials = async () =>
{
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
    fs.writeFile('.env',`IOTFLOWS_REMOTE_ACCESS_USERNAME=${username}\r\nIOTFLOWS_REMOTE_ACCESS_PASSWORD=${password}\r\n`, function (err) {
        if (err) throw err;
        console.log('Credentials stored.');
    });
    
    console.log('Credentials set.')   
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
    console.log(
    `
    Welcome to IoTFlows Remote Access service.
    You can enter your username and password`
    )    

    // Check arguments (delete or set username password if they are passed)
    var args = {}
    process.argv.slice(2).map(eachArg => { args[eachArg.split('=')[0]] = eachArg.split('=')[1] } )
    if(args.command && args.command == 'reset_credentials')
    {
        await deleteCredentials();
    }
    
    if(args.username && args.password)
    {
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
        }
        else
        {
            console.log("Bad credentials.")
            setCredentials();
            return
        }            
    }
}

// Start the program
begin()