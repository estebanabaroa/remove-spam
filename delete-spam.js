import dotenv from 'dotenv'
dotenv.config({quiet: true})
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
plebbit.on('error', console.log)

const moderatorSigner = await plebbit.createSigner()
const addAdmin = async (subplebbit) => {
  const roles = {...subplebbit.roles}
  roles[moderatorSigner.address] = {role: 'moderator'}
  await subplebbit.edit({roles})
  console.log('added moderator', moderatorSigner.address, 'to subplebbit', subplebbit.address)
}
const removeAdmin = async (subplebbit) => {
  const roles = {...subplebbit.roles}
  roles[moderatorSigner.address] = null
  await subplebbit.edit({roles})
  console.log('removed moderator', moderatorSigner.address, 'from subplebbit', subplebbit.address)
}

const spamMatches = [
  'Send 1 ETH to 0xeA3468c614B70230009ee6daFF17f9FB02B0Efc3 to end the attack',
  /^NIGGERS$/
]
const isSpam = (post) => {
  for (const spamMatch of spamMatches) {
    if (post.title?.match(spamMatch)) {
      return true
    }
  }
  return false
}

const thousandYears = Math.round(Date.now() / 1000) + 60 * 60 * 24 * 365 * 1000
const deleteSpam = async (address) => {
  const subplebbit = await plebbit.createSubplebbit({address})
  await addAdmin(subplebbit)
  console.log('started deleting spam for', address)
  for (const post of subplebbit.posts.pages.hot?.comments || []) {
    if (isSpam(post)) {
      const commentModeration = await plebbit.createCommentModeration({
        signer: moderatorSigner,
        commentCid: post.cid,
        subplebbitAddress: subplebbit.address,
        commentModeration: {
          removed: true,
          author: {banExpiresAt: thousandYears}
        }
      })
      const challengeVerificationPromise = new Promise(resolve => {
        setTimeout(resolve, 10000) // don't wait forever in case of bug
        commentModeration.once('challengeverification', challengeVerification => {
          if (challengeVerification.challengeSuccess) {
            console.log('removed', post.cid, 'with title:', post.title)
          }
          else {
            console.log('failed remove', post.cid, 'with title:', post.title)
            console.log(challengeVerification.reason)
          }
          resolve()
        })
      })
      await commentModeration.publish()
      await challengeVerificationPromise
    }
  }
  console.log('done deleting spam for', address)
  await removeAdmin(subplebbit)
}

plebbit.once('subplebbitschange', async () => {
  console.log('deleting spam for', plebbit.subplebbits)
  for (const address of plebbit.subplebbits) {
    await deleteSpam(address)
  }
  console.log('done deleting spam')
  process.exit()
})

// debug the rpc settings
// const rpcClient = Object.values(plebbit.clients.plebbitRpcClients)[0]
// rpcClient.on('settingschange', async () => {
//   console.log(plebbit.settings)
// })

// never crash
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err))
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection:', reason))
