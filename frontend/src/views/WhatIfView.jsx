// ============================================================================
// WhatIfView.jsx
// ============================================================================
// SimuCast's signature feature. Pick a trained model, adjust feature values
// with sliders, see predictions update live, save named scenarios, and see
// a sensitivity chart of which features matter most.
//
// Structure:
//   ┌─ Model picker (dropdown of all trained models)
//   ├─ Big prediction display (live-updating)
//   ├─ 2-column layout:
//   │    Left: feature sliders (numeric) and dropdowns (categorical)
//   │    Right: sensitivity chart + saved scenarios
//   └─ Save-scenario button
// ============================================================================

import { useEffect, useState, useRef } from 'react'
import { listModels } from '../api/models.js'
import { useParams } from 'react-router-dom'
import {
  predict as predictAPI,
  sensitivity as sensitivityAPI,
  listScenarios as listScenariosAPI,
  saveScenario as saveScenarioAPI,
  deleteScenario as deleteScenarioAPI,
} from '../api/whatif.js'


export default function WhatIfView() {
  const { projectId } = useParams()

  // --- Model list ---
  const [models, setModels] = useState([])
  const [selectedModelId, setSelectedModelId] = useState(null)
  const [loadingModels, setLoadingModels] = useState(true)

  useEffect(() => {
    listModels(projectId)
      .then((list) => {
        setModels(list)
        if (list.length > 0) setSelectedModelId(list[0].id)
      })
      .catch(console.error)
      .finally(() => setLoadingModels(false))
  }, [projectId])

  // --- Empty states ---
  if (loadingModels) {
    return <div className="text-sm text-gray-400">Loading models...</div>
  }

  if (models.length === 0) {
    return (
      <div>
        <h1 className="text-base font-medium mb-1">What-if analysis</h1>
        <div className="bg-white border border-dashed border-gray-300 rounded-md p-8 text-center mt-4">
          <p className="text-sm text-gray-600 mb-2">No trained models yet</p>
          <p className="text-xs text-gray-500">
            Train a model in the <span className="font-medium">Model</span> module first.
            Then come back here to run what-if scenarios on it.
          </p>
        </div>
      </div>
    )
  }

  const selectedModel = models.find((m) => m.id === selectedModelId)

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-base font-medium">What-if analysis</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Adjust inputs to see how the prediction changes
          </p>
        </div>

        {/* Model picker */}
        <select
          value={selectedModelId || ''}
          onChange={(e) => setSelectedModelId(Number(e.target.value))}
          className="border border-gray-200 rounded-md px-2.5 py-1.5 text-xs max-w-md"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>
      </div>

      {selectedModel && <Simulator model={selectedModel} projectId={projectId} />}
    </div>
  )
}


// ============================================================================
// Simulator — the live-updating prediction UI
// ============================================================================

function Simulator({ model, projectId }) {
  const details = model.details
  const featureStats = details.feature_stats
  const features = details.features_original

  // --- Input state: one entry per original feature, defaulted from training stats ---
  const [inputs, setInputs] = useState(() => {
    const defaults = {}
    for (const f of features) {
      const s = featureStats[f]
      if (s.type === 'numeric') {
        defaults[f] = Number(s.mean.toFixed(2))
      } else {
        defaults[f] = s.values[0]
      }
    }
    return defaults
  })

  // --- Prediction state ---
  const [prediction, setPrediction] = useState(null)
  const [predicting, setPredicting] = useState(false)
  const [sensitivity, setSensitivity] = useState(null)
  const [scenarios, setScenarios] = useState([])

  // Debounce predictions so we don't spam the backend on every slider wiggle
  const debounceRef = useRef(null)

  function runPrediction() {
    // Cancel any pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setPredicting(true)
      try {
        const res = await predictAPI(model.id, inputs)
        setPrediction(res)
      } catch (err) {
        console.error('Prediction error:', err)
        setPrediction(null)
      } finally {
        setPredicting(false)
      }
    }, 200)  // 200ms debounce
  }

  // Run prediction whenever inputs change
  useEffect(runPrediction, [inputs, model.id])

  // Run sensitivity analysis once on model change
  useEffect(() => {
    setSensitivity(null)
    sensitivityAPI(model.id, inputs)
      .then(setSensitivity)
      .catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.id])

  // Load saved scenarios when model changes
  useEffect(() => {
    listScenariosAPI(model.id).then(setScenarios).catch(console.error)
  }, [model.id])

  // --- Handlers ---
  function updateInput(feature, value) {
    setInputs({ ...inputs, [feature]: value })
  }

  async function handleSaveScenario() {
    const name = prompt('Name this scenario:', 'My scenario')
    if (!name?.trim()) return
    try {
      const saved = await saveScenarioAPI(model.id, name.trim(), inputs, prediction?.prediction)
      setScenarios([saved, ...scenarios])
    } catch (err) {
      alert('Save failed: ' + (err.response?.data?.error || err.message))
    }
  }

  async function handleDeleteScenario(scenarioId) {
    if (!window.confirm('Delete this scenario?')) return
    try {
      await deleteScenarioAPI(scenarioId)
      setScenarios(scenarios.filter((s) => s.id !== scenarioId))
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  // Re-apply a saved scenario's inputs so the user can tweak and save a new one
  function loadScenario(s) {
    setInputs(s.inputs)
  }

  return (
    <div>
      {/* Big prediction display */}
      <PredictionHero
        prediction={prediction}
        target={details.target}
        predicting={predicting}
        onSaveScenario={handleSaveScenario}
      />

      <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* LEFT: input controls */}
        <div className="bg-white border border-gray-200 rounded-md p-4">
          <div className="text-xs font-medium mb-3">Inputs</div>
          <div className="flex flex-col gap-3">
            {features.map((feature) => (
              <InputControl
                key={feature}
                feature={feature}
                stats={featureStats[feature]}
                value={inputs[feature]}
                onChange={(v) => updateInput(feature, v)}
              />
            ))}
          </div>
        </div>

        {/* RIGHT: sensitivity + scenarios */}
        <div className="flex flex-col gap-4">
          <SensitivityPanel sensitivity={sensitivity} />
          <ScenariosPanel
            scenarios={scenarios}
            onLoad={loadScenario}
            onDelete={handleDeleteScenario}
          />
        </div>
      </div>
    </div>
  )
}


// ============================================================================
// Prediction hero — big live-updating number
// ============================================================================

function PredictionHero({ prediction, target, predicting, onSaveScenario }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-5 flex items-center justify-between">
      <div>
        <div className="text-[11px] text-gray-500 mb-1">
          Predicted {target}
          {predicting && <span className="ml-2 text-gray-400">·&nbsp;updating...</span>}
        </div>
        <PredictionValue prediction={prediction} />
      </div>
      <button
        onClick={onSaveScenario}
        disabled={!prediction}
        className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
      >
        + Save scenario
      </button>
    </div>
  )
}


function PredictionValue({ prediction }) {
  if (!prediction) {
    return <div className="text-2xl font-medium text-gray-300">—</div>
  }

  const p = prediction.prediction
  if (p.target_type === 'continuous') {
    return (
      <div className="text-3xl font-medium text-brand-500" style={{ lineHeight: 1.1 }}>
        {p.value.toLocaleString()}
      </div>
    )
  }

  // Classification
  const probDisplay = p.probability !== undefined
    ? `${(p.probability * 100).toFixed(1)}%`
    : null

  return (
    <div>
      <div className="text-3xl font-medium text-brand-500" style={{ lineHeight: 1.1 }}>
        {p.value}
      </div>
      {probDisplay && (
        <div className="text-xs text-gray-500 mt-1">
          confidence: {probDisplay}
        </div>
      )}
    </div>
  )
}


// ============================================================================
// Input control — numeric slider OR categorical dropdown
// ============================================================================

function InputControl({ feature, stats, value, onChange }) {
  if (stats.type === 'numeric') {
    return <NumericSlider feature={feature} stats={stats} value={value} onChange={onChange} />
  }
  return <CategoricalSelect feature={feature} stats={stats} value={value} onChange={onChange} />
}


function NumericSlider({ feature, stats, value, onChange }) {
  // Slider bounds: extend a bit beyond the training min/max so user can explore
  // outside the observed range
  const min = stats.min
  const max = stats.max
  const stepSize = (max - min) / 100 || 1

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <div className="text-xs text-gray-700 font-medium">{feature}</div>
        <div className="text-xs text-gray-500 font-mono">
          {typeof value === 'number' ? value.toFixed(2) : value}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={stepSize}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
        <span>{min.toFixed(1)}</span>
        <span>μ = {stats.mean.toFixed(1)}</span>
        <span>{max.toFixed(1)}</span>
      </div>
    </div>
  )
}


function CategoricalSelect({ feature, stats, value, onChange }) {
  return (
    <div>
      <div className="text-xs text-gray-700 font-medium mb-1">{feature}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
      >
        {stats.values.map((v) => (
          <option key={v} value={v}>{String(v)}</option>
        ))}
      </select>
    </div>
  )
}


// ============================================================================
// Sensitivity panel
// ============================================================================

function SensitivityPanel({ sensitivity }) {
  if (!sensitivity) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-4">
        <div className="text-xs font-medium mb-2">Sensitivity</div>
        <div className="text-[11px] text-gray-400">Computing...</div>
      </div>
    )
  }

  const items = sensitivity.sensitivities
  const maxImpact = Math.max(...items.map((i) => i.impact)) || 1

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <div className="text-xs font-medium mb-1">Which features move the prediction most</div>
      <div className="text-[10px] text-gray-500 mb-3">
        Computed at the baseline inputs · higher = more sensitive
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => {
          const pct = (item.impact / maxImpact) * 100
          return (
            <div key={item.feature} className="flex items-center gap-2">
              <div className="text-[11px] w-24 truncate text-gray-600" title={item.feature}>
                {item.feature}
              </div>
              <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full bg-brand-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[10px] w-12 text-right font-mono">{item.impact.toFixed(3)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ============================================================================
// Scenarios panel
// ============================================================================

function ScenariosPanel({ scenarios, onLoad, onDelete }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <div className="text-xs font-medium mb-2">Saved scenarios ({scenarios.length})</div>

      {scenarios.length === 0 ? (
        <div className="text-[11px] text-gray-400 italic">
          Click "Save scenario" above to capture the current inputs.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {scenarios.map((s) => {
            const p = s.prediction
            const display = p?.target_type === 'continuous'
              ? p.value?.toLocaleString()
              : p?.value

            return (
              <div key={s.id} className="border border-gray-100 rounded-md p-2 flex items-center justify-between">
                <button
                  onClick={() => onLoad(s)}
                  className="flex-1 text-left hover:bg-gray-50 -m-2 p-2 rounded"
                  title="Click to load these inputs"
                >
                  <div className="text-xs font-medium truncate">{s.name}</div>
                  <div className="text-[11px] text-brand-600 font-mono">{display}</div>
                </button>
                <button
                  onClick={() => onDelete(s.id)}
                  className="ml-2 text-gray-400 hover:text-red-600 text-sm"
                  title="Delete scenario"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
