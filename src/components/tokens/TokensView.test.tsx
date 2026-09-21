// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TokenComponentsInspector } from './TokensView'

afterEach(cleanup)

describe('token components inspector', () => {
  it('uses the shared inspector navigation to select a component or return to overview', () => {
    const onSelect = vi.fn()
    const { rerender } = render(<TokenComponentsInspector selected={null} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Button' }))
    expect(onSelect).toHaveBeenCalledWith('button')

    rerender(<TokenComponentsInspector selected="button" onSelect={onSelect} />)
    expect(screen.getByRole('button', { name: 'Button' }).className).toContain('font-medium')
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }))
    expect(onSelect).toHaveBeenLastCalledWith(null)
  })
})
