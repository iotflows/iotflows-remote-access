# IoTFlows Remote Access

https://iotflows.com

IoTFlow Remote Access Agent for remote SSH and remote Node-RED for IoT gateways.

By installing this application on your device, you can: 
1. Remotely SSH to your device 
2. Remotely access [Node-RED](https://nodered.org/), a flow-based development tool, running on your device
3. Utilize IoTFlows Node-RED nodes: 
   1. Data Streams: for secure real-time communication to the cloud (MQTTS/WebSockets)
   2. Alert Channels: for alerts and notifications (SMS/Email)
   3. Actions: to define a function that can be called with REST API / MQTTS commands from the cloud
4. Remotely deploy and manage Docker containers

![IoTFlows-Remote-Access: Managed remote SSH and remote Node-RED for IoT gateways.](/images/iotflows-console.png)
![IoTFlows-Remote-Access: Managed remote SSH and remote Node-RED for IoT gateways.](/images/remote-nodered.png)


Check out https://docs.iotflows.com for full instructions on getting started.

## Quick Start

1. Generate a Remote Connection Access Key for your device in [IoTFlows Console](https://console.iotflows.com) and run the following commands on your IoT device 
2. Run the following command on your IoT device:

I) For Debian-Based Operating System (e.g. Ubuntu, MX Linux. Linux Mint Desktop, Raspberry Pi OS):
`bash <(sudo curl -s https://cdn.iotflows.com/update-nodejs-and-iotflows-remote-access.sh) --username=xxxx --password=yyyy --confirm-install`

II) For Other Operating Systems:
- Install npm and [Node.js](https://nodejs.org/en/)
- Install IoTFlows Remote Access: `sudo npm install -g --unsafe-perm @iotflows/iotflows-remote-access`
- Connect the agent to the cloud: `sudo iotflows-remote-access username=xxxx password=yyyy command=reset_credentials`

3. In the Remote Connections tab in the console, create and enable Remote SSH or Remote Node-RED and follow the instructions to connect to your device. The default credentials for remote Node-RED are `admin` and `password`.

## Installation
### Prerequisites
To install IoTFlows Remote Access, you will need a supported version of [Node.js](https://nodejs.org/en/download/).
- If your operating system supports apt:
`sudo apt update`
`sudo apt install npm`
`sudo apt install nodejs`

- [Windows Installer](https://nodejs.org/en/#home-downloadhead)

### IoTFlows Console Setup
1. Create an account in [IoTFlows Console](https://console.iotflows.com).
2. Add a device and generate a device remote client username and password.

### IoT Device Setup
1. Run the following commands on your device:   
    * `sudo npm install -g --unsafe-perm @iotflows/iotflows-remote-access`
    * `sudo iotflows-remote-access username=xxxx password=yyyy command=reset_credentials`
2. Enter the remote access credentials (username and password)
3. In IoTFlows Console, create a Remote Connection for Node-RED or SSH and follow the instructions to remotely access your device. 
4. After rebooting your device, IoTFlow Remote Access will auto start on boot.
    * To stop the service:
    `sudo systemctl stop iotflows-remote-access.service`

    * To start the service:
    `sudo systemctl start iotflows-remote-access.service`

    * To disable the service:
    `sudo systemctl disable iotflows-remote-access.service`