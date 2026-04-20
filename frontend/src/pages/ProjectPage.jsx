// ============================================================================
// ProjectPage.jsx  —  WEEK 4 VERSION
// ============================================================================
// Changes from Week 3:
//   - ModelView now receives onChange={refreshProject} so timeline updates
//     after a model is trained.
//
// Includes all Week 2 (Timeline) and Week 3 (Expand wiring) functionality.
// ============================================================================

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject } from '../api/projects.js'
import { rollbackToStep } from '../api/history.js'

// Views
import DataView from '../views/DataView.jsx'
import CleanView from '../views/CleanView.jsx'
import ExpandView from '../views/ExpandView.jsx'
import StatsView from '../views/StatsView.jsx'
import TestsView from '../views/TestsView.jsx'
import ModelView from '../views/ModelView.jsx'
import WhatIfView from '../views/WhatIfView.jsx'
import ReportView from '../views/ReportView.jsx'

// Components
import IconSidebar from '../components/IconSidebar.jsx'
import AIChat from '../components/AIChat.jsx'
import Timeline from '../components/Timeline.jsx'
import Modal from '../components/Modal.jsx'


export default function ProjectPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState(null)
  const [datasets, setDatasets] = useState([])
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeModule, setActiveModule] = useState('data')
  const [aiCollapsed, setAiCollapsed] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)

  useEffect(() => {
    getProject(projectId)
      .then((res) => {
        setProject(res.project)
        setDatasets(res.datasets)
        setSteps(res.steps)
      })
      .catch((err) => {
        console.error(err)
        alert('Could not load project')
        navigate('/')
      })
      .finally(() => setLoading(false))
  }, [projectId, navigate])

  function refreshProject() {
    getProject(projectId).then((res) => {
      setDatasets(res.datasets)
      setSteps(res.steps)
    })
  }

  async function handleRollback(step) {
    const confirm = window.confirm(
      `Roll back to before "${step.title}"?\n\nThis undoes that step AND everything after it.`
    )
    if (!confirm) return
    try {
      await rollbackToStep(project.id, step.id)
      refreshProject()
    } catch (err) {
      alert('Rollback failed: ' + (err.response?.data?.error || err.message))
    }
  }

  const currentDataset = datasets[datasets.length - 1] || null

  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault()
        setAiCollapsed((c) => !c)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading project...</div>
  if (!project) return null

  const activeStepCount = steps.filter((s) => !s.reverted).length

  return (
    <div className="min-h-screen bg-stone-50">

      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            onClick={() => navigate('/')}
            className="w-6 h-6 rounded-md bg-brand-500 text-white flex items-center justify-center text-xs font-medium cursor-pointer"
            title="Back to dashboard"
          >S</div>
          <span className="text-sm font-medium">SimuCast</span>
          <span className="text-sm text-gray-400">/ {project.name}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTimelineOpen(true)}
            className="text-xs border border-gray-200 rounded-md px-2.5 py-1 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
          >
            <span>Timeline</span>
            {activeStepCount > 0 && (
              <span className="bg-brand-100 text-brand-700 text-[10px] rounded px-1.5 font-medium">
                {activeStepCount}
              </span>
            )}
          </button>
          <button className="text-xs border border-gray-200 rounded-md px-2.5 py-1 text-gray-600 hover:bg-gray-50">Save</button>
          <button className="text-xs bg-brand-500 hover:bg-brand-600 text-white rounded-md px-2.5 py-1">Export</button>
        </div>
      </header>

      <div
        className="grid min-h-[calc(100vh-45px)]"
        style={{ gridTemplateColumns: aiCollapsed ? '60px 1fr 28px' : '60px 1fr 220px' }}
      >
        <IconSidebar activeModule={activeModule} onChange={setActiveModule} />

        <main className="p-5">
          {activeModule === 'data' && (
            <DataView project={project} currentDataset={currentDataset} onUpload={refreshProject} />
          )}
          {activeModule === 'clean' && (
            <CleanView dataset={currentDataset} onChange={refreshProject} />
          )}
          {activeModule === 'expand' && (
            <ExpandView dataset={currentDataset} onChange={refreshProject} />
          )}
          {activeModule === 'stats' && <StatsView dataset={currentDataset} />}
          {activeModule === 'tests' && <TestsView dataset={currentDataset} />}

          {/* --- UPDATED IN WEEK 4: onChange wired --- */}
          {activeModule === 'model' && (
            <ModelView dataset={currentDataset} onChange={refreshProject} />
          )}

          {/* What-If reads the project ID from URL params itself */}
          {activeModule === 'whatif' && <WhatIfView />}

          {activeModule === 'report' && <ReportView project={project} />}
        </main>

        <AIChat
          collapsed={aiCollapsed}
          onToggle={() => setAiCollapsed(!aiCollapsed)}
          datasetId={currentDataset?.id || null}
        />
      </div>

      <Modal
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        title={`Timeline (${activeStepCount} active steps)`}
        maxWidth="600px"
      >
        <p className="text-xs text-gray-500 mb-3">
          Every action you take is logged here. Click the × next to a step to
          roll back to before that step.
        </p>
        <Timeline steps={steps} onRollback={handleRollback} />
      </Modal>
    </div>
  )
}
