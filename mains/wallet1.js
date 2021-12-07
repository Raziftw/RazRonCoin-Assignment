const prompt = require('prompt');
const {
    Blockchain,
    Transaction
} = require('..\\BC_Part_4_1 - Full\\Blockchain4.js');
const EC = require('..\\BC_Part_4_1 - Full\\node_modules\\elliptic').ec;
const ec = new EC('secp256k1');
const saveListToFile = require("..\\serialize.js").saveListToFile;
const loadFileToList = require("..\\serialize.js").loadFileToList;

const topology = require('..\\BC_Part_5 p2p\\BC_Part_5 p2p\\node_modules\\fully-connected-topology')
const {
    stdin,
    exit,
    argv
} = process
const {
    log
} = console
const {
    me,
    peers
} = extractPeersAndMyPort()
const sockets = {}

log('---------------------')
log('Starting up WALLET NODE')
log('me - ', me)
log('peers - ', peers)
log('connecting to peers...')

const mykey =
    ec.keyFromPrivate('50c963fdb1557d9caa85be8e8c8846dc31b1af8fb9d2e9e2cdf13d758a325030')
const myWalletAddress = mykey.getPublic('hex');


const myIp = toLocalIp(me)
const peerIps = getPeerIps(peers)
const headers = [];

//connect to peers
topology(myIp, peerIps).on('connection', (socket, peerIp) => {
    const peerPort = extractPortFromIp(peerIp)
    log('connected to peer - ', peerPort)

    sockets[peerPort] = socket
    stdin.on('data', data => { //on user input
        const message = data.toString().trim()
        if (message === 'exit') { //on exit
            console.log("headers: ", headers)
            log('Bye bye')
            exit(0)
        }

            const receiverPeer = extractReceiverPeer(message)
            const splitMessage = message.split(' ')
            if (splitMessage[0] === 'send') { // user wants to send money
                sendTransaction(socket, splitMessage[1], splitMessage[2]);
            }
            else if (message === 'balance') { // user wants to see his balance
                console.log("requesting balance by sending: ", formatMessage("{\"balanceOfAddress\":"+ myWalletAddress +"}"));
                socket.write(formatMessage("{\"balanceOfAddress\":\""+ myWalletAddress +"\"}"));
            }
            else if(message == 'getHeaders'){
                const formattedMessage = formatMessage("{\"getHeaders\": \"thanks\"}");
                console.log("requesting blockchain headers by sending ", formattedMessage);
                socket.write(formattedMessage);
            }
            else if (sockets[receiverPeer]) { //message to specific peer
                if (peerPort === receiverPeer) { //write only once
                    sockets[receiverPeer].write(formatMessage(extractMessageToSpecificPeer(message)))
                }
            } else { //broadcast message to everyone
                socket.write(formatMessage(message))
            }
        }
    )

    //print data when received
    socket.on('data', data => receivedData(data, socket))
})

function receivedData(data, socket){
    console.log("data.toString(): ", data.toString())
    const jsonObj = JSON.parse(extractMessage(data.toString()))

    // check if it's a transaction
    if(jsonObj.previousHash && jsonObj.timestamp && jsonObj.nonce && jsonObj.merkleRoot){
        console.log('Adding header to array: ', jsonObj)
        headers.push(jsonObj)
    }

}

function extractMessage(message){
    return message.substring(message.indexOf(">")+1,  message.length);
}

function sendTransaction(socket, amount, toAddress){
    const tx1 = new Transaction(myWalletAddress,  toAddress, amount);
    tx1.signTransaction(mykey);
    console.log("sending transaction: ", JSON.stringify(tx1));
    socket.write(formatMessage(JSON.stringify(tx1)));
}


//extract ports from process arguments, {me: first_port, peers: rest... }
function extractPeersAndMyPort() {
    return {
        me: argv[2],
        peers: argv.slice(3, argv.length)
    }
}

//'4000' -> '127.0.0.1:4000'
function toLocalIp(port) {
    return `127.0.0.1:${port}`
}

//['4000', '4001'] -> ['127.0.0.1:4000', '127.0.0.1:4001']
function getPeerIps(peers) {
    return peers.map(peer => toLocalIp(peer))
}

//'hello' -> 'myPort:hello'
function formatMessage(message) {
    return `${me}>${message}`
}

//'127.0.0.1:4000' -> '4000'
function extractPortFromIp(peer) {
    return peer.toString().slice(peer.length - 4, peer.length);
}

//'4000>hello' -> '4000'
function extractReceiverPeer(message) {
    return message.slice(0, 4);
}

//'4000>hello' -> 'hello'
function extractMessageToSpecificPeer(message) {
    return message.slice(5, message.length);
}