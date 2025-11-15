import { Wallet } from 'ethers'
import { config } from 'dotenv'

// Load environment variables
config({ path: '../../.env' })

const wallet = new Wallet(process.env.AGENT_PRIVATE_KEY!)
console.log('Agent wallet address:', wallet.address)
