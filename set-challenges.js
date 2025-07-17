import dotenv from 'dotenv'
dotenv.config()
import Plebbit from '@plebbit/plebbit-js'
import util from 'util'
util.inspect.defaultOptions.depth = 10

const plebbitRpcUrl = process.env.RPC_URL
if (!plebbitRpcUrl) {
  console.log('missing env variable RPC_URL (the plebbit RPC URL, including the secret key, like "ws://<ip of your server>:9138/<secret-key>"')
  process.exit()
}

const plebbit = await Plebbit({
  plebbitRpcClientsOptions: [plebbitRpcUrl]
})

const setChallenges = async (address) => {
  const subplebbit = await plebbit.createSubplebbit({address})

  const settings = {...subplebbit.settings}
  settings.challenges = [{
    name: 'publication-match',
    options: {
      matches: JSON.stringify([{'propertyName':'author.address','regexp':'\\.(sol|eth)$'}]),
      error: 'Posting in this community requires a username (author address) that ends with .eth or .sol. Go to the settings to set your username.'
    },
    exclude: [
      // exclude mods
      {role: ['moderator', 'admin', 'owner']},
      // exclude old users
      {
        firstCommentTimestamp: 60 * 60 * 24 * 30, // 1 month
        postScore: 3,
        rateLimit: 2,
        replyScore: 0
      },
    ]
  }]

  try {
    await subplebbit.edit({settings})
    console.log('set challenges', subplebbit.address)
  }
  catch (e) {
    console.log('failed set challenges', address)
    console.log(e)
  }
}

plebbit.once('subplebbitschange', async () => {
  console.log('setting challenges for', plebbit.subplebbits)
  for (const address of plebbit.subplebbits) {
    await setChallenges(address)
  }
  console.log('done setting challenges')
  process.exit()
})

// debug the rpc settings
// const rpcClient = Object.values(plebbit.clients.plebbitRpcClients)[0]
// rpcClient.on('settingschange', async () => {
//   console.log(plebbit.settings)
// })
