import { describe, expect, it } from 'vitest'
import { catalogPatients, fetchFromGitHub } from './openSyntheticPatients'

describe('catalogPatients', () => {
  it('lists each patient with a raw GitHub URL for its clean bundle', () => {
    const [p] = catalogPatients({
      patients: [{ slug: 'mavis-dracula', name: 'Mavis Dracula', summary: 'S', path: 'patients/mavis-dracula', variants: { clean: 'bundle.json' } }],
    })
    expect(p.name).toBe('Mavis Dracula')
    expect(p.url).toBe('https://raw.githubusercontent.com/crookhaven/open-synthetic-patients/main/patients/mavis-dracula/bundle.json')
  })

  it('rejects a catalog in another format', () => {
    expect(() => catalogPatients({})).toThrow(/expected format/)
  })
})

describe('fetchFromGitHub', () => {
  it('reports a missing file plainly', async () => {
    const fetchImpl = async () => ({ ok: false, status: 404 })
    await expect(fetchFromGitHub('https://raw.githubusercontent.com/x/y/main/marketplace/plans.json', 'json', fetchImpl)).rejects.toThrow(
      'GitHub returned 404 for marketplace/plans.json.',
    )
  })

  it('reports a network failure plainly', async () => {
    const fetchImpl = async () => {
      throw new TypeError('Failed to fetch')
    }
    await expect(fetchFromGitHub('https://example.org/a.json', 'json', fetchImpl)).rejects.toThrow(/Could not reach GitHub/)
  })
})
