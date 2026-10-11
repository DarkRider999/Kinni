import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AssetCard, Button, Dialog, Dropzone, IconButton, NumberField, ProgressBar, TimelineClip, ToastProvider, TooltipProvider, useToast } from '../primitives'

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <ToastProvider>{children}</ToastProvider>
    </TooltipProvider>
  )
}

describe('Button', () => {
  it('loading disables, sets aria-busy and keeps the label', () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Exporting</Button>)
    const btn = screen.getByRole('button', { name: 'Exporting' })
    expect(btn).toHaveProperty('disabled', true)
    expect(btn.getAttribute('aria-busy')).toBe('true')
  })

  it('IconButton is labelled and exposes pressed state', () => {
    render(
      <Wrap>
        <IconButton label="Mute track" pressed>
          <svg />
        </IconButton>
      </Wrap>,
    )
    expect(screen.getByRole('button', { name: 'Mute track' }).getAttribute('aria-pressed')).toBe('true')
  })
})

function Controlled({ initial = 100, ...rest }: { initial?: number; min?: number; max?: number; step?: number }) {
  const [v, setV] = useState(initial)
  return <NumberField label="Scale" value={v} onChange={setV} unit="%" {...rest} />
}

describe('NumberField', () => {
  it('steps with arrows, ×10 with shift, clamps to max', async () => {
    const user = userEvent.setup()
    render(<Controlled min={0} max={120} />)
    const input = screen.getByRole('spinbutton', { name: 'Scale' }) as HTMLInputElement
    input.focus()
    await user.keyboard('{ArrowUp}')
    expect(input.value).toBe('101')
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}')
    expect(input.value).toBe('111')
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}')
    expect(input.value).toBe('120')
  })

  it('commits typed values on Enter, reverts on Escape and on garbage', async () => {
    const user = userEvent.setup()
    render(<Controlled min={0} max={400} step={1} />)
    const input = screen.getByRole('spinbutton', { name: 'Scale' }) as HTMLInputElement
    await user.clear(input)
    await user.type(input, '250.4{Enter}')
    expect(input.value).toBe('250')
    await user.clear(input)
    await user.type(input, '12{Escape}')
    expect(input.value).toBe('250')
    await user.clear(input)
    await user.type(input, 'abc')
    fireEvent.blur(input)
    expect(input.value).toBe('250')
  })
})

describe('Dialog', () => {
  it('renders title and description, closes on Escape', async () => {
    const user = userEvent.setup()
    function D() {
      const [open, setOpen] = useState(true)
      return (
        <Wrap>
          <Dialog open={open} onOpenChange={setOpen} title="Export video" description="Exports stay on this device." />
        </Wrap>
      )
    }
    render(<D />)
    expect(screen.getByRole('dialog', { name: 'Export video' })).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Toast', () => {
  it('announces a pushed toast', async () => {
    function Pusher() {
      const toast = useToast()
      return <button onClick={() => toast({ tone: 'success', title: 'Export finished' })}>go</button>
    }
    render(
      <Wrap>
        <Pusher />
      </Wrap>,
    )
    await act(async () => fireEvent.click(screen.getByText('go')))
    expect(screen.getAllByText('Export finished').length).toBeGreaterThan(0)
  })

  it('useToast outside a provider throws a clear error', () => {
    function Bad() {
      useToast()
      return null
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Bad />)).toThrow(/ToastProvider/)
    spy.mockRestore()
  })
})

describe('Media primitives', () => {
  it('Dropzone opens the picker from the keyboard and passes files', async () => {
    const onFiles = vi.fn()
    const { container } = render(<Dropzone accept="video/*" onFiles={onFiles} />)
    const input = container.querySelector('input[type=file]') as HTMLInputElement
    const click = vi.spyOn(input, 'click')
    const zone = screen.getByRole('button', { name: /drop videos/i })
    zone.focus()
    fireEvent.keyDown(zone, { key: 'Enter' })
    expect(click).toHaveBeenCalled()
    const file = new File(['x'], 'a.mp4', { type: 'video/mp4' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(onFiles).toHaveBeenCalledWith([file])
  })

  it('Dropzone shows an error as an alert', () => {
    render(<Dropzone accept="video/*" onFiles={() => {}} error="Unsupported codec" />)
    expect(screen.getByRole('alert').textContent).toBe('Unsupported codec')
  })

  it('AssetCard announces duration and locked state', () => {
    render(<AssetCard name="intro.mp4" kind="video" durationMs={65_000} />)
    expect(screen.getByRole('button', { name: 'intro.mp4, 1:05' })).toBeTruthy()
    render(<AssetCard name="Neon glitch" kind="image" locked />)
    expect(screen.getByRole('button', { name: 'Neon glitch, requires upgrade' })).toBeTruthy()
  })

  it('ProgressBar exposes value', () => {
    render(<ProgressBar label="Exporting" value={0.425} />)
    expect(screen.getByRole('progressbar', { name: 'Exporting' }).getAttribute('aria-valuenow')).toBe('43')
  })
})

describe('TimelineClip', () => {
  it('positions by time and nudges by frame / second', () => {
    const onNudge = vi.fn()
    render(<TimelineClip kind="video" label="Intro" startMs={2000} durationMs={1000} pxPerSec={50} selected onNudge={onNudge} frameMs={40} />)
    const clip = screen.getByRole('option', { name: /video clip Intro, starts 0:02.0, length 0:01.0/ })
    expect(clip.style.left).toBe('100px')
    expect(clip.style.width).toBe('50px')
    fireEvent.keyDown(clip, { key: 'ArrowRight' })
    fireEvent.keyDown(clip, { key: 'ArrowLeft', shiftKey: true })
    expect(onNudge.mock.calls).toEqual([[40], [-1000]])
  })
})
