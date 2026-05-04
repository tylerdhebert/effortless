import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  EffortTemplate,
  TemplatePlaybook,
  UpdateTemplatePlaybookInput,
} from '../../../core/types'
import { formatTemplate } from '../../lib/helpers'
import styles from './TemplatePlaybookTab.module.css'

const TEMPLATES: EffortTemplate[] = ['bugfix', 'delivery', 'investigation', 'discussion']

type TemplatePlaybookTabProps = {
  playbooks: TemplatePlaybook[]
  onSave: (input: UpdateTemplatePlaybookInput) => Promise<TemplatePlaybook>
  onReset: (template: EffortTemplate) => Promise<TemplatePlaybook>
  isSaving: boolean
  isResetting: boolean
}

export function TemplatePlaybookTab({
  playbooks,
  onSave,
  onReset,
  isSaving,
  isResetting,
}: TemplatePlaybookTabProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<EffortTemplate>('bugfix')
  const [draft, setDraft] = useState('')
  const [feedback, setFeedback] = useState<'saved' | 'reset' | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const playbookMap = useMemo(() => {
    return new Map(playbooks.map((playbook) => [playbook.template, playbook]))
  }, [playbooks])

  const selectedPlaybook = playbookMap.get(selectedTemplate) ?? null
  const currentBody = selectedPlaybook?.body ?? ''
  const isDirty = draft !== currentBody
  const isBusy = isSaving || isResetting

  useEffect(() => {
    setDraft(currentBody)
  }, [selectedTemplate, currentBody])

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current)
      }
    }
  }, [])

  function showFeedback(next: 'saved' | 'reset') {
    setFeedback(next)
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current)
    }
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null)
    }, 2200)
  }

  async function handleSave() {
    try {
      const playbook = await onSave({
        template: selectedTemplate,
        body: draft,
      })
      setDraft(playbook.body)
      showFeedback('saved')
    } catch {
      // ignore save errors here and leave the current draft in place
    }
  }

  async function handleReset() {
    try {
      const playbook = await onReset(selectedTemplate)
      setDraft(playbook.body)
      showFeedback('reset')
    } catch {
      // ignore reset errors here and keep the current draft in place
    }
  }

  return (
    <div className={styles.tab}>
      <div className={styles.workspace}>
        <div className={styles.templateRail} aria-label="playbook templates">
          <span className={styles.railLabel}>templates</span>
          <div className={styles.templateList}>
            {TEMPLATES.map((template) => {
              const selected = template === selectedTemplate
              return (
                <button
                  key={template}
                  type="button"
                  className={`${styles.templateButton} ${selected ? styles.templateButtonActive : ''}`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <strong>{formatTemplate(template)}</strong>
                </button>
              )
            })}
          </div>
        </div>

        <div className={styles.editorColumn}>
          <div className={styles.editorHeader}>
            <span className={styles.editorLabel}>{formatTemplate(selectedTemplate)} playbook</span>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => void handleReset()}
                disabled={isBusy}
              >
                {isResetting ? 'resetting' : 'reset'}
              </button>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => void handleSave()}
                disabled={!isDirty || isBusy}
              >
                {isSaving ? 'saving' : 'save'}
              </button>
            </div>
          </div>

          <textarea
            className={styles.editor}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add template workflow guidance"
            spellCheck={false}
          />

          <div className={styles.footer}>
            <span
              className={`${styles.feedback} ${
                feedback === 'saved' ? styles.feedbackSaved : feedback === 'reset' ? styles.feedbackReset : ''
              }`}
              aria-live="polite"
            >
              {feedback === 'saved' ? 'saved' : feedback === 'reset' ? 'reset to default' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
