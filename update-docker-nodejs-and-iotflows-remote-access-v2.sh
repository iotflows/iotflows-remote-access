#!/bin/sh
#
#  Copyright 2020-2022 IoTFlows Inc. All rights reserved.
#  Copyright 2016,2020 JS Foundation and other contributors, https://js.foundation/
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at 
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable laconsole.w or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#  -------------------------------------------------------------------------------
#  IoTFlows Remote Access Installer for DEBIAN based systems. https://iotflows.com
#  -------------------------------------------------------------------------------

umask 0022
tgta=12.22.1   # need armv6l latest from https://unofficial-builds.nodejs.org/download/release/
tgtl=12.16.3   # need x86 latest from https://unofficial-builds.nodejs.org/download/release/

usage() {
  cat << EOL
Usage: $0 [options]

Options:
  --help            display this help and exits
       install as root without asking confirmation
  --confirm-install confirm installation without asking confirmation
EOL
}

if [ $# -gt 0 ]; then
  # Parsing parameters
  while (( "$#" )); do
    case "$1" in
      --help)
        usage && exit 0
        shift
        ;;
      --confirm-install)
        CONFIRM_INSTALL="y"
        shift
        ;;
      --username=*)
        USERNAME="${1#*=}"
        shift
        ;;
      --password=*)
        PASSWORD="${1#*=}"
        shift
        ;;
      --) # end argument parsing
        shift
        break
        ;;
      -*|--*=) # unsupported flags
        echo "Error: Unsupported flag $1" >&2
        exit 1
        ;;
    esac
  done
fi


# Check if credentials are given
if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]
then
	echo ""
    echo "Missing required fields username and password. Obtain your credentials from https://console.iotflows.com"
    echo ""
    exit 1
fi

if [[ "$(uname)" != "Darwin" ]]; then
# if curl -f https://www.npmjs.com/package/iotflows-remote-access  >/dev/null 2>&1; then
if curl -I https://registry.npmjs.org/@iotflows-remote-access/util  >/dev/null 2>&1; then
echo -e '\033]2;'IoTFlows Remote Access update'\007'
echo " "
echo "This script will install the latest version of Docker and will remove versions of "
echo "Node.js prior to version 12.x, and if necessary replace them with Node.js 12.x LTS "
echo "(erbium) and the latest of IoTFlows Remote Access Agent."
echo " "
echo "It also tries to run 'npm rebuild' to refresh any extra nodes you have installed"
echo "that may have a native binary component. While this normally works ok, you need"
echo "to check that it succeeds for your combination of installed nodes."
echo " "
echo "To do all this it runs commands as root - please satisfy yourself that this will"
echo "not damage your machine, or otherwise compromise your configuration."
echo "If in doubt please backup your hard drive first."
echo " "
if [[ -e $HOME/.nvm ]]; then
    echo -ne '\033[1mNOTE:\033[0m We notice you are using \033[38;5;88mnvm\033[0m. Please ensure it is running the current LTS version.\n'
    echo -ne 'Using nvm is NOT RECOMMENDED. IoTFlows Remote Access will not run as a service under nvm.\r\n\n'
fi

yn="${CONFIRM_INSTALL}"
[ ! "${yn}" ] && read -p "Are you really sure you want to do this ? [y/N] ? " yn
case $yn in
    [Yy]* )
        echo ""
        EXTRANODES=""
        EXTRAW="update"

        MYOS=$(cat /etc/*release | grep "^ID=" | cut -d = -f 2)
        IOTFLOWS_REMOTE_ACCESS_HOME=$HOME
        IOTFLOWS_REMOTE_ACCESS_USER=$USER
        IOTFLOWS_REMOTE_ACCESS_GROUP=`id -gn`
        GLOBAL="true"
        TICK='\033[1;32m\u2714\033[0m'
        CROSS='\033[1;31m\u2718\033[0m'
        cd "$IOTFLOWS_REMOTE_ACCESS_HOME" || exit 1
        clear
        echo -e "\nThis installation can take 10-20 minutes on the slower machines - please wait.\n"
        echo -e "\nRunning IoTFlows Remote Access $EXTRAW for user $USER at $HOME on $MYOS\n"
        time1=$(date)
        echo "" | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
        echo "***************************************" | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
        echo "" | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
        echo "Started : "$time1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
        
        # stop any running iotflows-remote-access service
        if sudo service iotflows-remote-access stop 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null ; then CHAR=$TICK; else CHAR=$CROSS; fi
        echo -ne "  Stop IoTFlows Remote Access                       $CHAR\r\n"

        # remove any old iotflows-remote-access installs or files
        sudo npm remove -y iotflows-remote-access 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
        # sudo npm remove -y iotflows-remote-access-update 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
        sudo rm -rf /usr/local/lib/node_modules/iotflows-remote-access* /usr/local/lib/node_modules/npm /usr/local/bin/iotflows-remote-access* /usr/local/bin/node /usr/local/bin/npm 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
        sudo rm -rf /usr/lib/node_modules/iotflows-remote-access* /usr/bin/iotflows-remote-access* 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
        echo -ne '  Remove old version of IoTFlows Remote Access      \033[1;32m\u2714\033[0m\r\n'

        echo -ne "  Install Docker LTS                                \r"
        # use the official script to install the docker
        if bash <(curl -fsSL https://get.docker.com) 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null; then CHAR=$TICK; else CHAR=$CROSS; fi        
        echo -ne "  Install Docker LTS                                $CHAR\r\n"
                
        nv="v0"
        nv2=""
        ndeb=$(apt-cache policy nodejs | grep Installed | awk '{print $2}')
        if [[ -x "$(command -v node)" ]]; then
            nv=`node -v | cut -d "." -f1`
            nv2=`node -v`
            # nv2=`apt list nodejs 2>/dev/null | grep dfsg | cut -d ' ' -f 2 | cut -d '-' -f 1`
            echo "Already have nodejs $nv2" | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
        fi
        # ensure ~/.config dir is owned by the user
        echo "Now install nodejs" | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
        sudo chown -Rf $IOTFLOWS_REMOTE_ACCESS_USER:$IOTFLOWS_REMOTE_ACCESS_GROUP $IOTFLOWS_REMOTE_ACCESS_HOME/.config/
        # maybe remove Node.js - or upgrade if nodesoure.list exists
        if [[ "$(uname -m)" =~ "i686" ]]; then
            echo "Using i686" | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
            curl -sSL -o /tmp/node.tgz https://unofficial-builds.nodejs.org/download/release/v$tgtl/node-v$tgtl-linux-x86.tar.gz 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
            # unpack it into the correct places
            hd=$(head -c 9 /tmp/node.tgz)
            if [ "$hd" == "<!DOCTYPE" ]; then
                CHAR="$CROSS File $f not downloaded";
            else
                if sudo tar -zxf /tmp/node.tgz --strip-components=1 -C /usr 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null; then CHAR=$TICK; else CHAR=$CROSS; fi
            fi
            rm /tmp/node.tgz 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
            echo -ne "  Install Node.js for i686            $CHAR"
        elif uname -m | grep -q armv6l ; then
            sudo apt remove -y nodejs nodejs-legacy npm 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
            sudo rm -rf /etc/apt/sources.d/nodesource.list /usr/lib/node_modules/npm*
            echo -ne "  Remove old version of Node.js       $TICK\r\n"
            echo -ne "  Install Node.js for Armv6           \r"
            # f=$(curl -sL https://nodejs.org/download/release/latest-dubnium/ | grep "armv6l.tar.gz" | cut -d '"' -f 2)
            # curl -sL -o node.tgz https://nodejs.org/download/release/latest-dubnium/$f 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
            curl -sSL -o /tmp/node.tgz https://unofficial-builds.nodejs.org/download/release/v$tgta/node-v$tgta-linux-armv6l.tar.gz 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
            # unpack it into the correct places
            hd=$(head -c 9 /tmp/node.tgz)
            if [ "$hd" == "<!DOCTYPE" ]; then
                CHAR="$CROSS File $f not downloaded";
            else
                if sudo tar -zxf /tmp/node.tgz --strip-components=1 -C /usr 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null; then CHAR=$TICK; else CHAR=$CROSS; fi
            fi
            # remove the tgz file to save space
            rm /tmp/node.tgz 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
            echo -ne "  Install Node.js for Armv6           $CHAR"       
        elif [[ $(which n) ]]; then
            echo "Using n" | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
            echo -ne "  Using N to manage Node.js           +\r\n"
            if sudo n lts 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null; then CHAR=$TICK; else CHAR=$CROSS; fi
            echo -ne "  Update Node.js LTS                  $CHAR"
        elif [ "$nv" = "v0" ] || [ "$nv" = "v1" ] || [ "$nv" = "v3" ] || [ "$nv" = "v4" ] || [ "$nv" = "v5" ] || [ "$nv" = "v6" ] || [ "$nv" = "v7" ] || [ "$nv" = "v8" ] || [ "$nv" = "v9" ] || [ "$nv2" = "v10.23.1" ] || [ "$nv" = "v11" ] || [ "$nv" = "v13" ] || [[ "$ndeb" =~ "dfsg" ]]; then
            echo "Updating nodejs $nv2" | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
            if [[ -f /etc/apt/sources.list.d/nodesource.list ]]; then
                echo "Using nodesource.list" | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
                if [ "$nv" = "v0" ] || [ "$nv" = "v1" ] || [ "$nv" = "v3" ] || [ "$nv" = "v4" ] || [ "$nv" = "v5" ] || [ "$nv" = "v6" ] || [ "$nv" = "v7" ] || [ "$nv" = "v8" ] || [ "$nv" = "v9" ] || [ "$nv2" = "v10.23.1" ] || [ "$nv" = "v11" ] || [ "$nv" = "v13" ] || [[ "$ndeb" =~ "dfsg" ]]; then
                    echo "Removing nodejs "$nv | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
                    sudo apt remove -y nodejs nodejs-legacy npm 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
                    sudo rm -rf /etc/apt/sources.d/nodesource.list /usr/lib/node_modules/npm*
                    if curl -sSL https://deb.nodesource.com/setup_18.x | sudo -E bash - 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null; then CHAR=$TICK; else CHAR=$CROSS; fi
                else
                    CHAR="-"
                fi
                echo -ne "  Remove old version of Node.js       $CHAR  $nv\r\n"
                echo -ne "  Update Node.js LTS                  \r"
                if sudo apt install -y nodejs 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null; then CHAR=$TICK; else CHAR=$CROSS; fi
                echo -ne "  Update Node.js LTS                  $CHAR"
            else
                # clean out old nodejs stuff
                echo "Not using nodesource.list" | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
                npv=$(npm -v 2>/dev/null | head -n 1 | cut -d "." -f1)
                sudo apt remove -y nodejs nodejs-legacy npm 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
                sudo dpkg -r nodejs 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
                sudo dpkg -r node 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
                sudo rm -rf /opt/nodejs 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
                sudo rm -f /usr/local/bin/node* 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
                sudo rm -rf /usr/local/bin/npm* /usr/local/bin/npx* /usr/lib/node_modules/npm* 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
                if [ "$npv" = "1" ]; then
                    sudo rm -rf /usr/local/lib/node_modules/iotflows-remote-access* /usr/lib/node_modules/iotflows-remote-access* 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
                fi
                sudo apt -y autoremove 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
                echo -ne "  Remove old version of Node.js       \033[1;32m\u2714\033[0m\r\n"
                echo "Grab the LTS bundle" | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
                echo -ne "  Install Node.js LTS                 \r"
                # use the official script to install for other debian platforms
                sudo apt install -y curl 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
                curl -sSL https://deb.nodesource.com/setup_18.x | sudo -E bash - 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
                if sudo apt install -y nodejs 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null; then CHAR=$TICK; else CHAR=$CROSS; fi
                echo -ne "  Install Node.js LTS                 $CHAR"
            fi
        else
            CHAR="-"
            echo -ne "  Remove old version of Node.js       $CHAR\n"
            echo -ne "  Leave existing Node.js              $CHAR"
        fi
        NUPG=$CHAR
        hash -r
        rc=""
        if nov=$(node -v 2>/dev/null); then :; else rc="ERR"; fi
        if npv=$(npm -v 2>/dev/null); then :; else rc="ERR"; fi
        echo "Versions: node:$nov npm:$npv" | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
        if [[ "$rc" == "" ]]; then
            echo -ne "   Node $nov   Npm $npv\r\n"
        else
            echo -ne "\b$CROSS   Failed to install Node.js - Exit\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n"
            exit 2
        fi
        if [ "$EUID" == "0" ]; then npm config set unsafe-perm true &>/dev/null; fi

        # clean up the npm cache and node-gyp
        if [[ "$NUPG" == "$TICK" ]]; then
            if [[ "$GLOBAL" == "true" ]]; then
                sudo npm cache clean --force 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
            else
                npm cache clean --force 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
            fi
            if sudo rm -rf "$IOTFLOWS_REMOTE_ACCESS_HOME/.node-gyp" "$IOTFLOWS_REMOTE_ACCESS_HOME/.npm" /root/.node-gyp /root/.npm; then CHAR=$TICK; else CHAR=$CROSS; fi
        fi
        echo -ne "  Clean npm cache                     $CHAR\r\n"

        # and install IoTFlows Remote Access
        echo "Now install IoTFlows Remote Access" | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null

        if sudo npm install @iotflows/iotflows-remote-access -g --unsafe-perm 2>&1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null; then CHAR=$TICK; else CHAR=$CROSS; fi
        echo -ne "  Install IoTFlows Remote Access       $CHAR\r\n"
        
        echo -ne "  Launching the remote access. \r\n"         
        sudo iotflows-remote-access username=$USERNAME password=$PASSWORD command=reset_credentials 
        echo -ne "\r\nInstallation Started  $time1  -  Finished  $(date)\r\n\r\n"
        echo "Memory : $(free -h -t | grep Total | awk '{print $2}' | cut -d i -f 1)" | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
        echo "Finished : "$time1 | sudo tee -a /var/log/iotflows-remote-access-install.log >>/dev/null
    ;;
    * )
        echo " "
        exit 1
    ;;
esac
else
echo " "
echo "Sorry - cannot connect to internet - not going to touch anything."
echo "https://www.npmjs.com/package/iotflows-remote-access   is not reachable."
echo "Please ensure you have a working internet connection."
echo "Return code from curl is "$?
echo " "
exit 1
fi
else
echo " "
echo "Sorry, this installation is not supposed to be run on a Mac."
echo "Please see the documentation at https://docs.iotflows.com/."
echo " "
exit 1
fi
