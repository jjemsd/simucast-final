// ============================================================================
// ModelView.jsx
// ============================================================================
// Train predictive models. Three tabs:
//   1. Linear regression   (continuous target)
//   2. Logistic regression (binary target)
//   3. Decision tree       (either — auto-detected by target)
//
// After training, shows metrics + feature importance/coefficients.
// AI interprets the result in plain English.
// ============================================================================

import { useState } from 'react'
import { trainLinear, trainLogistic, trainTree } from '../api/models.js'
import { interpret as aiInterpret } from '../api/ai.js'


export default function ModelView({ dataset, onChange }) {
  const [activeTab, setActiveTab] = useState('linear')

  if (!dataset) {
    return (
      <div>
        <h1 className="text-base font-medium mb-1">Build a model</h1>
        <p className="text-sm text-gray-500">Upload a dataset in the Data module first.</p>
      </div>
    )
  }

  const columns = Object.keys(dataset.columns_info)
  const numericCols = columns.filter((c) => {
    const d = dataset.columns_info[c] || ''
    return d.includes('int') || d.includes('float')
  })

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-base font-medium">Build a model</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {dataset.row_count} rows · Trained models appear in the What-If module
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { id: 'linear',   label: 'Linear regression' },
          { id: 'logistic', label: 'Logistic regression' },
          { id: 'tree',     label: 'Decision tree' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={
              'px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ' +
              (activeTab === tab.id
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-900')
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'linear' && (
        <TrainForm
          title="Linear regression"
          description="Predicts a continuous numeric outcome from the selected features. Target must be numeric."
          targetOptions={numericCols}
          allColumns={columns}
          trainFn={trainLinear}
          modelType="linear_regression"
          dataset={dataset}
          onChange={onChange}
        />
      )}

      {activeTab === 'logistic' && (
        <TrainForm
          title="Logistic regression"
          description="Predicts a binary outcome (yes/no, 0/1, true/false). Target must have exactly 2 values."
          targetOptions={columns}
          allColumns={columns}
          trainFn={trainLogistic}
          modelType="logistic_regression"
          dataset={dataset}
          onChange={onChange}
        />
      )}

      {activeTab === 'tree' && (
        <TrainForm
          title="Decision tree"
          description="Auto-handles both regression and classification based on target type."
          targetOptions={columns}
          allColumns={columns}
          trainFn={(id, target, features) => trainTree(id, target, features, 5)}
          modelType="decision_tree"
          dataset={dataset}
          onChange={onChange}
          extraControl={{ label: 'max_depth', hint: 'Deeper trees fit training data better but can overfit.' }}
        />
      )}
    </div>
  )
}


// ============================================================================
// Training form (shared across all three tabs)
// ============================================================================

function TrainForm({ title, description, targetOptions, allColumns, trainFn, modelType, dataset, onChange }) {
  // Target and features are user choices
  const [target, setTarget] = useState(targetOptions[0] || '')
  const [selectedFeatures, setSelectedFeatures] = useState(new Set())

  // Result state
  const [result, setResult] = useState(null)
  const [interpretation, setInterpretation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleFeature(col) {
    const next = new Set(selectedFeatures)
    if (next.has(col)) next.delete(col)
    else next.add(col)
    setSelectedFeatures(next)
  }

  async function handleTrain() {
    if (!target) { setError('Pick a target column'); return }
    if (selectedFeatures.size === 0) { setError('Pick at least one feature'); return }
    if (selectedFeatures.has(target)) { setError('Target cannot also be a feature'); return }

    setError(''); setResult(null); setInterpretation(null)
    setLoading(true)
    try {
      const step = await trainFn(dataset.id, target, Array.from(selectedFeatures))
      setResult(step)
      onChange?.()

      // Also fetch AI interpretation (best-effort — don't block on failure)
      try {
        const details = step.details
        const text = await aiInterpret(modelType, {
          target, model_type: modelType, ...details.metrics,
        })
        setInterpretation(text)
      } catch {
        setInterpretation('(AI interpretation unavailable)')
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  // Available features = every column except target
  const availableFeatures = allColumns.filter((c) => c !== target)

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-md p-4 mb-4 max-w-3xl">
        <p className="text-xs text-gray-500 mb-4">{description}</p>

        <Field label="Target column (what you're predicting)">
          <select
            value={target}
            onChange={(e) => {
              setTarget(e.target.value)
              // Deselect target from features if present
              const next = new Set(selectedFeatures)
              next.delete(e.target.value)
              setSelectedFeatures(next)
            }}
            className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs"
          >
            {targetOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <div className="text-xs font-medium text-gray-700 mb-1 mt-3">
          Features ({selectedFeatures.size} selected)
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto border border-gray-100 rounded-md p-2 mb-3">
          {availableFeatures.map((col) => {
            const isSelected = selectedFeatures.has(col)
            return (
              <button
                key={col}
                onClick={() => toggleFeature(col)}
                className={
                  'text-xs rounded-md px-2 py-1 border ' +
                  (isSelected
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-brand-400')
                }
              >
                {col}
              </button>
            )
          })}
        </div>

        <button
          onClick={handleTrain}
          disabled={loading || !target || selectedFeatures.size === 0}
          className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
        >
          {loading ? 'Training...' : 'Train model'}
        </button>

        {error && (
          <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {result && <ModelResult step={result} interpretation={interpretation} />}
    </div>
  )
}


// ============================================================================
// Result display
// ============================================================================

function ModelResult({ step, interpretation }) {
  const details = step.details
  const metrics = details.metrics || {}
  const modelType = details.model_type
  const isClassification = details.target_type === 'binary' || details.target_type === 'multiclass'

  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden max-w-3xl">
      {/* Header */}
      <div className="px-4 py-2.5 text-xs font-medium bg-green-50 text-green-800 border-b border-green-200">
        ✓ {step.title}
      </div>

      {/* Metrics grid */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {!isClassification ? (
          <>
            <Metric label="R² (test)"   value={metrics.r2_test} />
            <Metric label="R² (train)"  value={metrics.r2_train} />
            <Metric label="RMSE"        value={metrics.rmse_test} />
            <Metric label="MAE"         value={metrics.mae_test} />
          </>
        ) : (
          <>
            <Metric label="Accuracy"  value={metrics.accuracy} percent />
            {metrics.f1 !== undefined && <Metric label="F1"         value={metrics.f1} />}
            {metrics.precision !== undefined && <Metric label="Precision"  value={metrics.precision} />}
            {metrics.recall !== undefined && <Metric label="Recall"     value={metrics.recall} />}
            {metrics.roc_auc !== undefined && <Metric label="ROC AUC"    value={metrics.roc_auc} />}
          </>
        )}
      </div>

      {/* Feature importance / coefficients */}
      {(metrics.feature_importances || metrics.coefficients) && (
        <div className="px-4 pb-4">
          <div className="text-xs font-medium mb-2">
            {metrics.feature_importances ? 'Feature importance' : 'Coefficients (scaled)'}
          </div>
          <FeatureBars items={metrics.feature_importances || metrics.coefficients} />
        </div>
      )}

      {/* Confusion matrix for classification */}
      {metrics.confusion_matrix && (
        <div className="px-4 pb-4">
          <div className="text-xs font-medium mb-2">Confusion matrix</div>
          <ConfusionMatrix
            matrix={metrics.confusion_matrix}
            labels={metrics.class_labels}
          />
        </div>
      )}

      {/* AI interpretation */}
      {interpretation && (
        <div className="bg-brand-50 border-t border-brand-200 px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-brand-600 text-xs mt-0.5">✦</span>
            <div className="text-xs text-brand-900 leading-relaxed">{interpretation}</div>
          </div>
        </div>
      )}
    </div>
  )
}


function Metric({ label, value, percent = false }) {
  let display = value
  if (value === null || value === undefined) display = '—'
  else if (percent) display = `${(value * 100).toFixed(1)}%`
  else display = typeof value === 'number' ? value.toFixed(4) : value

  return (
    <div className="bg-gray-50 rounded-md px-3 py-2">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className="text-base font-medium">{display}</div>
    </div>
  )
}


function FeatureBars({ items }) {
  if (!items || items.length === 0) return null

  // Sort by absolute value so biggest influences appear first
  const sorted = [...items].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  const maxAbs = Math.max(...sorted.map((i) => Math.abs(i.value)))

  return (
    <div className="flex flex-col gap-1">
      {sorted.map((item) => {
        const pct = maxAbs > 0 ? (Math.abs(item.value) / maxAbs) * 100 : 0
        const isNegative = item.value < 0
        return (
          <div key={item.feature} className="flex items-center gap-2">
            <div className="text-[11px] w-32 truncate text-gray-600" title={item.feature}>
              {item.feature}
            </div>
            <div className="flex-1 h-4 bg-gray-100 rounded relative overflow-hidden">
              <div
                className={isNegative ? 'h-full bg-red-400' : 'h-full bg-brand-500'}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[11px] w-16 text-right font-medium">
              {item.value.toFixed(4)}
            </div>
          </div>
        )
      })}
    </div>
  )
}


function ConfusionMatrix({ matrix, labels }) {
  return (
    <div className="inline-block border border-gray-200 rounded-md overflow-hidden">
      <table className="text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-1.5 font-medium text-gray-500">actual ↓ / predicted →</th>
            {labels?.map((l) => (
              <th key={l} className="px-3 py-1.5 font-medium text-gray-700">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="px-3 py-1.5 font-medium text-gray-700 bg-gray-50">{labels?.[i]}</td>
              {row.map((cell, j) => (
                <td key={j} className={'px-3 py-1.5 text-right ' + (i === j ? 'bg-green-50 font-medium' : '')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


function Field({ label, children }) {
  return (
    <div className="mb-3">
      <div className="text-xs font-medium text-gray-700 mb-1">{label}</div>
      {children}
    </div>
  )
}
