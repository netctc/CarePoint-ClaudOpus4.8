import Link from 'next/link';

const coverageMetrics = [
  { label: 'Active coverage rules', value: '—', description: 'Connect this card to /api/coverage/rules when the API route is available.' },
  { label: 'Pending reviews', value: '—', description: 'Rules that need finance, compliance, or operations review.' },
  { label: 'Affected services', value: '—', description: 'Catalog services currently governed by coverage logic.' },
];

const workflow = [
  'Define payer, plan, region, service, and facility scope.',
  'Validate eligibility, prior authorization, co-pay, and exclusion rules.',
  'Audit every publish, suspend, archive, and rollback action.',
  'Expose safe read-only coverage results to booking and payment workflows.',
];

export default function CoveragePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <section className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">Coverage governance</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Coverage Rules</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Manage service eligibility, plan coverage, patient cost sharing, exclusions, and operational rule governance.
                This recovery page restores the Admin route so navigation no longer returns 404 while the full coverage
                rules module is connected to live API data.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/portal/catalog/services"
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Service catalog
              </Link>
              <Link
                href="/portal/dashboard"
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {coverageMetrics.map((item) => (
            <article key={item.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{item.value}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Implementation status</h2>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Area</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Next action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
                  <tr>
                    <td className="px-4 py-3 font-medium text-slate-950">Admin route</td>
                    <td className="px-4 py-3">Recovered</td>
                    <td className="px-4 py-3">Keep route at apps/admin/src/app/portal/coverage/page.tsx</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-slate-950">Coverage API</td>
                    <td className="px-4 py-3">Pending verification</td>
                    <td className="px-4 py-3">Wire to /api/coverage or catalog coverage endpoints when confirmed</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-slate-950">Audit policy</td>
                    <td className="px-4 py-3">Required</td>
                    <td className="px-4 py-3">Log publish, suspend, archive, and rollback actions</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Coverage workflow</h2>
            <ol className="mt-5 space-y-4">
              {workflow.map((item, index) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </aside>
        </section>
      </section>
    </main>
  );
}
