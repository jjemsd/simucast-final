// ============================================================================
// TestsView.jsx  —  WEEK 6 VERSION
// ============================================================================
// Same 4-tab structure as Week 3. Added "Save to report" buttons on each
// result panel so the user can curate which test results go into their thesis.
// ============================================================================

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  tTestOneSample, tTestIndependent, tTestPaired,
  anovaOneWay, correlation, chiSquare,
} from '../api/tests.js'
import { interpret as aiInterpret } from '../api/ai.js'
import { saveReportItem } from '../api/reports.js'


export default function TestsView({ dataset }) {
  const [activeTab, setActiveTab] = useState('ttest')
  const { projectId } = useParams()

  if (!dataset) {
    return (
      <div>
        <h1 className="text-base font-medium mb-1">Statistical tests</h1>
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
        <h1 className="text-base font-medium">Statistical tests</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {dataset.row_count} rows · {dataset.column_count} columns
        </p>
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { id: 'ttest',      label: 'T-tests' },
          { id: 'anova',      label: 'ANOVA' },
          { id: 'correlation',label: 'Correlation' },
          { id: 'chisq',      label: 'Chi-square' },
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

      {activeTab === 'ttest'      && <TTestTab dataset={dataset} columns={columns} numericCols={numericCols} projectId={projectId} />}
      {activeTab === 'anova'      && <ANOVATab dataset={dataset} columns={columns} numericCols={numericCols} projectId={projectId} />}
      {activeTab === 'correlation'&& <CorrelationTab dataset={dataset} numericCols={numericCols} projectId={projectId} />}
      {activeTab === 'chisq'      && <ChiSquareTab dataset={dataset} columns={columns} projectId={projectId} />}
    </div>
  )
}


// ============================================================================
// Save-to-report button (matches StatsView version)
// ============================================================================

function SaveToReportButton({ kind, title, data, projectId }) {
  const [state, setState] = useState('idle')

  async function handleSave() {
    setState('saving')
    try {
      await saveReportItem(projectId, kind, title, data)
      setState('saved')
      setTimeout(() => setState('idle'), 3000)
    } catch (err) {
      alert('Save failed: ' + (err.response?.data?.error || err.message))
      setState('idle')
    }
  }

  if (state === 'saved') {
    return <span className="text-[11px] text-green-700 font-medium">✓ Added to report</span>
  }
  return (
    <button
      onClick={handleSave}
      disabled={state === 'saving'}
      className="text-[11px] border border-gray-200 rounded-md px-2 py-0.5 text-gray-600 hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
    >
      {state === 'saving' ? 'Saving...' : '+ Save to report'}
    </button>
  )
}


// ============================================================================
// Shared: runs test + gets AI interpretation
// ============================================================================

async function runWithInterpretation(apiCall, testType) {
  const result = await apiCall()
  let interpretation = null
  try {
    interpretation = await aiInterpret(testType, result)
  } catch {
    interpretation = '(AI interpretation unavailable)'
  }
  return { result, interpretation }
}


// ============================================================================
// Result panel — now with save button in header
// ============================================================================

function ResultPanel({ title, rows, interpretation, significant, savePayload, projectId }) {
  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-md overflow-hidden">
      <div className={
        'px-4 py-2.5 text-xs font-medium border-b border-gray-200 flex items-center justify-between gap-3 ' +
        (significant === true ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-700')
      }>
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate">{title}</span>
          {significant === true && <span className="text-[10px] bg-green-600 text-white rounded px-1.5 py-0.5 shrink-0">significant</span>}
          {significant === false && <span className="text-[10px] bg-gray-400 text-white rounded px-1.5 py-0.5 shrink-0">not significant</span>}
        </div>

        {savePayload && (
          <div className="shrink-0">
            <SaveToReportButton
              projectId={projectId}
              kind={savePayload.kind}
              title={savePayload.title}
              data={savePayload.data}
            />
          </div>
        )}
      </div>

      <table className="w-full text-xs">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-gray-100 last:border-b-0">
              <td className="px-4 py-1.5 text-gray-500 w-1/2">{label}</td>
              <td className="px-4 py-1.5 font-medium">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

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


// ============================================================================
// Tab 1 — T-tests (3 sub-types)
// ============================================================================

function TTestTab({ dataset, columns, numericCols, projectId }) {
  const [subType, setSubType] = useState('independent')

  return (
    <div>
      <div className="flex gap-1.5 mb-4">
        {[
          { id: 'one-sample',  label: 'One-sample' },
          { id: 'independent', label: 'Independent' },
          { id: 'paired',      label: 'Paired' },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSubType(opt.id)}
            className={
              'text-xs rounded-md px-3 py-1.5 border ' +
              (subType === opt.id
                ? 'bg-brand-50 border-brand-400 text-brand-700 font-medium'
                : 'bg-white border-gray-200 text-gray-600 hover:border-brand-300')
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {subType === 'one-sample'  && <OneSampleTForm dataset={dataset} numericCols={numericCols} projectId={projectId} />}
      {subType === 'independent' && <IndependentTForm dataset={dataset} columns={columns} numericCols={numericCols} projectId={projectId} />}
      {subType === 'paired'      && <PairedTForm dataset={dataset} numericCols={numericCols} projectId={projectId} />}
    </div>
  )
}


function OneSampleTForm({ dataset, numericCols, projectId }) {
  const [column, setColumn] = useState(numericCols[0] || '')
  const [testValue, setTestValue] = useState('0')
  const [output, setOutput] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRun() {
    setError(''); setOutput(null); setLoading(true)
    try {
      const { result, interpretation } = await runWithInterpretation(
        () => tTestOneSample(dataset.id, column, parseFloat(testValue)),
        'one_sample_t_test',
      )
      setOutput({ result, interpretation })
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 max-w-2xl">
      <p className="text-xs text-gray-500 mb-3">Tests whether a column's mean differs from a specific value.</p>

      <Field label="Numeric column">
        <select value={column} onChange={(e) => setColumn(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs">
          {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label="Test value">
        <input type="number" value={testValue} onChange={(e) => setTestValue(e.target.value)}
               className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs" />
      </Field>

      <RunButton loading={loading} onClick={handleRun} />
      {error && <ErrorBox message={error} />}

      {output && (
        <ResultPanel
          title={`One-sample t-test · ${output.result.column} vs ${output.result.test_value}`}
          significant={output.result.significant}
          interpretation={output.interpretation}
          projectId={projectId}
          savePayload={{
            kind: 't_test',
            title: `One-sample t-test: ${output.result.column} vs ${output.result.test_value}`,
            data: output.result,
          }}
          rows={[
            ['n',                  output.result.n],
            ['Sample mean',        output.result.sample_mean],
            ['Sample SD',          output.result.sample_std],
            ['t statistic',        output.result.t_statistic],
            ['Degrees of freedom', output.result.degrees_of_freedom],
            ['p value',            output.result.p_value],
            ["Cohen's d",          output.result.cohens_d],
          ]}
        />
      )}
    </div>
  )
}


function IndependentTForm({ dataset, columns, numericCols, projectId }) {
  const [numericCol, setNumericCol] = useState(numericCols[0] || '')
  const [groupCol, setGroupCol]     = useState(columns[0] || '')
  const [output, setOutput] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRun() {
    setError(''); setOutput(null); setLoading(true)
    try {
      const { result, interpretation } = await runWithInterpretation(
        () => tTestIndependent(dataset.id, numericCol, groupCol),
        'independent_t_test',
      )
      setOutput({ result, interpretation })
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 max-w-2xl">
      <p className="text-xs text-gray-500 mb-3">
        Compares means between two groups. Group column must have exactly 2 values.
      </p>

      <Field label="Numeric column">
        <select value={numericCol} onChange={(e) => setNumericCol(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs">
          {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label="Group column">
        <select value={groupCol} onChange={(e) => setGroupCol(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs">
          {columns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <RunButton loading={loading} onClick={handleRun} />
      {error && <ErrorBox message={error} />}

      {output && (
        <ResultPanel
          title={`Independent t-test · ${output.result.numeric_column} by ${output.result.group_column}`}
          significant={output.result.significant}
          interpretation={output.interpretation}
          projectId={projectId}
          savePayload={{
            kind: 't_test',
            title: `Independent t-test: ${output.result.numeric_column} by ${output.result.group_column}`,
            data: output.result,
          }}
          rows={[
            [`${output.result.group_1.name} (n=${output.result.group_1.n})`,
             `mean ${output.result.group_1.mean}, SD ${output.result.group_1.std}`],
            [`${output.result.group_2.name} (n=${output.result.group_2.n})`,
             `mean ${output.result.group_2.mean}, SD ${output.result.group_2.std}`],
            ['Mean difference', output.result.mean_difference],
            ['t statistic',     output.result.t_statistic],
            ['p value',         output.result.p_value],
            ["Cohen's d",       output.result.cohens_d],
          ]}
        />
      )}
    </div>
  )
}


function PairedTForm({ dataset, numericCols, projectId }) {
  const [colA, setColA] = useState(numericCols[0] || '')
  const [colB, setColB] = useState(numericCols[1] || numericCols[0] || '')
  const [output, setOutput] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRun() {
    setError(''); setOutput(null); setLoading(true)
    try {
      const { result, interpretation } = await runWithInterpretation(
        () => tTestPaired(dataset.id, colA, colB),
        'paired_t_test',
      )
      setOutput({ result, interpretation })
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 max-w-2xl">
      <p className="text-xs text-gray-500 mb-3">
        Compares two numeric columns on the same rows (before/after).
      </p>

      <Field label="Column A">
        <select value={colA} onChange={(e) => setColA(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs">
          {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label="Column B">
        <select value={colB} onChange={(e) => setColB(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs">
          {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <RunButton loading={loading} onClick={handleRun} />
      {error && <ErrorBox message={error} />}

      {output && (
        <ResultPanel
          title={`Paired t-test · ${output.result.column_a} vs ${output.result.column_b}`}
          significant={output.result.significant}
          interpretation={output.interpretation}
          projectId={projectId}
          savePayload={{
            kind: 't_test',
            title: `Paired t-test: ${output.result.column_a} vs ${output.result.column_b}`,
            data: output.result,
          }}
          rows={[
            ['Paired observations', output.result.n_pairs],
            [`Mean of ${output.result.column_a}`, output.result.mean_a],
            [`Mean of ${output.result.column_b}`, output.result.mean_b],
            ['Mean difference', output.result.mean_difference],
            ['t statistic', output.result.t_statistic],
            ['p value', output.result.p_value],
            ["Cohen's d", output.result.cohens_d],
          ]}
        />
      )}
    </div>
  )
}


// ============================================================================
// Tab 2 — ANOVA
// ============================================================================

function ANOVATab({ dataset, columns, numericCols, projectId }) {
  const [numericCol, setNumericCol] = useState(numericCols[0] || '')
  const [groupCol, setGroupCol]     = useState(columns[0] || '')
  const [output, setOutput] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRun() {
    setError(''); setOutput(null); setLoading(true)
    try {
      const { result, interpretation } = await runWithInterpretation(
        () => anovaOneWay(dataset.id, numericCol, groupCol),
        'one_way_anova',
      )
      setOutput({ result, interpretation })
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 max-w-2xl">
      <p className="text-xs text-gray-500 mb-3">Compares means across 3+ groups.</p>

      <Field label="Numeric column">
        <select value={numericCol} onChange={(e) => setNumericCol(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs">
          {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label="Group column">
        <select value={groupCol} onChange={(e) => setGroupCol(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs">
          {columns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <RunButton loading={loading} onClick={handleRun} />
      {error && <ErrorBox message={error} />}

      {output && (
        <>
          <ResultPanel
            title={`One-way ANOVA · ${output.result.numeric_column} by ${output.result.group_column}`}
            significant={output.result.significant}
            interpretation={output.interpretation}
            projectId={projectId}
            savePayload={{
              kind: 'anova',
              title: `ANOVA: ${output.result.numeric_column} by ${output.result.group_column}`,
              data: output.result,
            }}
            rows={[
              ['Total n',       output.result.n],
              ['Groups',        output.result.num_groups],
              ['F statistic',   output.result.f_statistic],
              ['df (between)',  output.result.df_between],
              ['df (within)',   output.result.df_within],
              ['p value',       output.result.p_value],
              ['η² (effect)',   output.result.eta_squared],
            ]}
          />
          <div className="mt-3 bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="px-4 py-2 text-xs font-medium bg-gray-50 border-b border-gray-200">Group means</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="px-4 py-1.5 text-left font-normal">Group</th>
                  <th className="px-4 py-1.5 text-right font-normal">n</th>
                  <th className="px-4 py-1.5 text-right font-normal">Mean</th>
                  <th className="px-4 py-1.5 text-right font-normal">SD</th>
                </tr>
              </thead>
              <tbody>
                {output.result.groups.map((g) => (
                  <tr key={g.name} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-4 py-1.5 font-medium">{g.name}</td>
                    <td className="px-4 py-1.5 text-right">{g.n}</td>
                    <td className="px-4 py-1.5 text-right">{g.mean}</td>
                    <td className="px-4 py-1.5 text-right">{g.std}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}


// ============================================================================
// Tab 3 — Correlation
// ============================================================================

function CorrelationTab({ dataset, numericCols, projectId }) {
  const [colA, setColA]     = useState(numericCols[0] || '')
  const [colB, setColB]     = useState(numericCols[1] || numericCols[0] || '')
  const [method, setMethod] = useState('pearson')
  const [output, setOutput] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRun() {
    setError(''); setOutput(null); setLoading(true)
    try {
      const { result, interpretation } = await runWithInterpretation(
        () => correlation(dataset.id, colA, colB, method),
        `${method}_correlation`,
      )
      setOutput({ result, interpretation })
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 max-w-2xl">
      <p className="text-xs text-gray-500 mb-3">Measures the relationship between two numeric columns.</p>

      <Field label="Column A">
        <select value={colA} onChange={(e) => setColA(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs">
          {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label="Column B">
        <select value={colB} onChange={(e) => setColB(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs">
          {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label="Method">
        <select value={method} onChange={(e) => setMethod(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs">
          <option value="pearson">Pearson (linear)</option>
          <option value="spearman">Spearman (rank-based)</option>
          <option value="kendall">Kendall (rank-based)</option>
        </select>
      </Field>

      <RunButton loading={loading} onClick={handleRun} />
      {error && <ErrorBox message={error} />}

      {output && (
        <ResultPanel
          title={`${output.result.method} correlation · ${output.result.column_a} vs ${output.result.column_b}`}
          significant={output.result.significant}
          interpretation={output.interpretation}
          projectId={projectId}
          savePayload={{
            kind: 'correlation',
            title: `${output.result.method} correlation: ${output.result.column_a} vs ${output.result.column_b}`,
            data: output.result,
          }}
          rows={[
            ['n',              output.result.n],
            ['r (coefficient)', output.result.r],
            ['r² (variance)',  output.result.r_squared],
            ['p value',        output.result.p_value],
            ['Strength',       `${output.result.strength} ${output.result.direction}`],
          ]}
        />
      )}
    </div>
  )
}


// ============================================================================
// Tab 4 — Chi-square
// ============================================================================

function ChiSquareTab({ dataset, columns, projectId }) {
  const [colA, setColA] = useState(columns[0] || '')
  const [colB, setColB] = useState(columns[1] || columns[0] || '')
  const [output, setOutput] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRun() {
    setError(''); setOutput(null); setLoading(true)
    try {
      const { result, interpretation } = await runWithInterpretation(
        () => chiSquare(dataset.id, colA, colB),
        'chi_square_independence',
      )
      setOutput({ result, interpretation })
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 max-w-3xl">
      <p className="text-xs text-gray-500 mb-3">Tests whether two categorical columns are independent.</p>

      <Field label="Column A">
        <select value={colA} onChange={(e) => setColA(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs">
          {columns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label="Column B">
        <select value={colB} onChange={(e) => setColB(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs">
          {columns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <RunButton loading={loading} onClick={handleRun} />
      {error && <ErrorBox message={error} />}

      {output && (
        <>
          <ResultPanel
            title={`Chi-square · ${output.result.column_a} × ${output.result.column_b}`}
            significant={output.result.significant}
            interpretation={output.interpretation}
            projectId={projectId}
            savePayload={{
              kind: 'chi_square',
              title: `Chi-square: ${output.result.column_a} × ${output.result.column_b}`,
              data: output.result,
            }}
            rows={[
              ['n',                    output.result.n],
              ['χ² statistic',         output.result.chi2],
              ['Degrees of freedom',   output.result.degrees_of_freedom],
              ['p value',              output.result.p_value],
              ["Cramér's V (effect)",  output.result.cramers_v],
            ]}
          />

          <div className="mt-3 bg-white border border-gray-200 rounded-md overflow-auto">
            <div className="px-4 py-2 text-xs font-medium bg-gray-50 border-b border-gray-200">
              Observed frequencies
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-1.5 text-left font-medium text-gray-500"></th>
                  {output.result.contingency_table.columns.map((c) => (
                    <th key={c} className="px-3 py-1.5 text-right font-medium text-gray-700">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {output.result.contingency_table.rows.map((row, i) => (
                  <tr key={row} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-3 py-1.5 font-medium text-gray-700">{row}</td>
                    {output.result.contingency_table.values[i].map((v, j) => (
                      <td key={j} className="px-3 py-1.5 text-right">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}


// ============================================================================
// Small shared pieces
// ============================================================================

function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      <div className="text-xs font-medium text-gray-700 mb-1">{label}</div>
      {children}
      {hint && <div className="text-[10px] text-gray-500 mt-1">{hint}</div>}
    </div>
  )
}

function RunButton({ loading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="mt-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
    >
      {loading ? 'Running test...' : 'Run test'}
    </button>
  )
}

function ErrorBox({ message }) {
  return (
    <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
      {message}
    </div>
  )
}
