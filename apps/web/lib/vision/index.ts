import 'server-only'
import type { VisionProvider } from './types'
import { OpenAIVisionProvider } from './openai.adapter'

// Swap adapter here only
const vision: VisionProvider = new OpenAIVisionProvider()
export default vision
