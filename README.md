# IoTFlows Remote Access

https://iotflows.com

Managed remote SSH and remote Node-RED for IoT gateways.

By installing this application on your device, you can: 
1. Remotely SSH to your device 
2. Remotely access [Node-RED](https://nodered.org/), a flow-based development tool, running on your device
3. Utilize IoTFlows Node-RED nodes: 
   1. Data Streams: for secure real-time communication to the cloud (MQTTS/WebSockets)
   2. Alert Channels: for alerts and notifications (SMS/Email)
   3. Actions: to define a function that can be called with REST API / MQTTS commands from the cloud

![IoTFlows-Remote-Access: Managed remote SSH and remote Node-RED for IoT gateways.](/images/iotflows-console.png)
![IoTFlows-Remote-Access: Managed remote SSH and remote Node-RED for IoT gateways.](/images/remote-nodered.png)

## Quick Start

Check out https://docs.iotflows.com/remote-access for full instructions on getting started.

1. Install [Node.js](https://nodejs.org)
2. Generate a remote client username/password for your device in [IoTFlows Console](https://console.iotflows.com).
3. `sudo npm install -g --unsafe-perm @iotflows/iotflows-remote-access`
4. `sudo iotflows-remote-access`
5. Activate Remote SSH or Remote Node-RED in IoTFlows Console and follow the instructions to connect to your device.

## Installation
### Prerequisites
To install IoTFlows Remote Access, you will need a supported version of [Node.js](https://nodejs.org/en/download/).
- Ubuntu
`curl -sL https://deb.nodesource.com/setup_15.x | sudo -E bash -`
`sudo apt-get install -y nodejs`

- Debian, as root
`curl -sL https://deb.nodesource.com/setup_15.x | bash -`
`apt-get install -y nodejs`

- macOS
`brew install node`
- [Windows Installer](https://nodejs.org/en/#home-downloadhead)

### IoTFlows Console Setup
1. Create an account in [IoTFlows Console](https://console.iotflows.com).
2. Add a device and generate a device remote client username and password.

### IoT Device Setup
1. Run the following commands on your device:   
    * `sudo npm install -g --unsafe-perm @iotflows/iotflows-remote-access`
    * `sudo iotflows-remote-access`
2. Enter the remote access credentials (username and password)
3. In IoTFlows Console, create a Remote Connection for Node-RED or SSH and follow the instructions to remotely access your device. 

