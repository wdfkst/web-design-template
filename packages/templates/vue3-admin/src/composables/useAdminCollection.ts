import { createRepository } from '../data/repository'
import { collections, MOCK_ROWS } from '../data/mock'

const repository = createRepository(collections, MOCK_ROWS)
export const useAdminCollection = repository.getCollection
