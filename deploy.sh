#!/usr/bin/env bash

# deploy to a server

# go to current folder
cd "$(dirname "$0")"

# add env vars
if [ -f .deploy-env ]; then
  export $(echo $(cat .deploy-env | sed 's/#.*//g'| xargs) | envsubst)
fi

# check creds
if [ -z "${DEPLOY_HOST+xxx}" ]; then echo "DEPLOY_HOST not set" && exit; fi
if [ -z "${DEPLOY_USER+xxx}" ]; then echo "DEPLOY_USER not set" && exit; fi
if [ -z "${DEPLOY_PASSWORD+xxx}" ]; then echo "DEPLOY_PASSWORD not set" && exit; fi

# add env vars
if [ -f .env ]; then
  export $(echo $(cat .env | sed 's/#.*//g'| xargs) | envsubst)
fi

# check creds
if [ -z "${RPC_URL+xxx}" ]; then echo "RPC_URL not set" && exit; fi

SCRIPT="
cd /home
git clone https://github.com/estebanabaroa/remove-spam.git
cd remove-spam
git reset HEAD --hard && git clean -fd
git pull
git log -1
"

# install deps on first run
# SCRIPT="
# sudo apt update && sudo apt install nodejs node chromium-browser
# sudo npm install -g n && n 20
# "

# execute script over ssh
echo "$SCRIPT" | sshpass -p "$DEPLOY_PASSWORD" ssh "$DEPLOY_USER"@"$DEPLOY_HOST"

# copy files
FILE_NAMES=(
  # ".env"
)

# copy files
for FILE_NAME in ${FILE_NAMES[@]}; do
  sshpass -p "$DEPLOY_PASSWORD" scp $FILE_NAME "$DEPLOY_USER"@"$DEPLOY_HOST":/home/plebbit-js-benchmark
done

SCRIPT="
cd /home/remove-spam
# npm install
# RPC_URL=$RPC_URL node delete-spam
nohup bash -c 'RPC_URL=\"$RPC_URL\" node delete-spam' > delete-spam.log 2>&1 &
tail -f delete-spam.log
"

echo "$SCRIPT" | sshpass -p "$DEPLOY_PASSWORD" ssh "$DEPLOY_USER"@"$DEPLOY_HOST"
