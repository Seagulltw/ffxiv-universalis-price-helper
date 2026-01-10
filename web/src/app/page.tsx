const sampleRows = [
  { type: '成品', hq: true, name: '球粒隕石圓頭錘', qty: 1, price: 50000, total: 50000 },
  { type: '材料', hq: false, name: '球粒隕石錠', qty: 3, price: 2200, total: 6600 },
  { type: '材料', hq: false, name: '完滿木木材', qty: 1, price: 2900, total: 2900 },
  { type: '材料', hq: false, name: '潛能量碎晶', qty: 1, price: 1850, total: 1850 },
  { type: '材料', hq: false, name: '火之水晶', qty: 8, price: 37, total: 296 },
  { type: '材料', hq: false, name: '土之水晶', qty: 8, price: 37, total: 296 }
];

const subRows = [
  { type: '成品', hq: false, name: '球粒隕石錠', qty: 1, price: 2200, total: 2200 },
  { type: '材料', hq: false, name: '球粒隕石', qty: 5, price: 498, total: 2490 },
  { type: '材料', hq: false, name: '暗銀礦', qty: 1, price: 180, total: 180 },
  { type: '材料', hq: false, name: '火之水晶', qty: 8, price: 37, total: 296 }
];

function formatNumber(value: number) {
  return value.toLocaleString('en-US');
}

export default function Home() {
  return (
    <main className="max-w-6xl mx-auto space-y-10">
      <header className="bg-slate-800 text-white rounded-3xl px-8 py-6 shadow-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm tracking-[0.4em] uppercase text-white/70">Universalis 查價</p>
            <h1 className="text-3xl font-bold mt-2">製作收益試算</h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="text-sm">
              <span className="block text-white/70 mb-2">世界</span>
              <select className="text-slate-900">
                <option>鳳凰</option>
                <option>迦樓羅</option>
                <option>陸行鳥</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-white/70 mb-2">目標物</span>
              <input className="text-slate-900" defaultValue="球粒隕石圓頭錘" />
            </label>
          </div>
        </div>
      </header>

      <section className="grid gap-8 lg:grid-cols-2">
        <article className="card space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">目標成品</h2>
              <p className="text-sm text-slate-500 mt-2">計算製作成本與收益</p>
            </div>
            <div className="text-amber-400">★★★★★</div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm">
              <span className="block text-slate-500 mb-2">成品售價</span>
              <input defaultValue="150000" />
            </label>
            <label className="text-sm">
              <span className="block text-slate-500 mb-2">單次製作時間 (分鐘)</span>
              <input defaultValue="50" />
            </label>
            <label className="text-sm">
              <span className="block text-slate-500 mb-2">製作次數</span>
              <input defaultValue="3" />
            </label>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-3 py-2 text-left">分類</th>
                  <th className="px-3 py-2">HQ</th>
                  <th className="px-3 py-2 text-left">物品名稱</th>
                  <th className="px-3 py-2">數量</th>
                  <th className="px-3 py-2">單價</th>
                  <th className="px-3 py-2">總價</th>
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row) => (
                  <tr key={row.name} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-2">
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-1 text-xs">{row.type}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" defaultChecked={row.hq} />
                    </td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2 text-center">{row.qty}</td>
                    <td className="px-3 py-2 text-center">{formatNumber(row.price)}</td>
                    <td className="px-3 py-2 text-center">{formatNumber(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="bg-blue-500 text-white text-sm font-semibold rounded-lg px-4 py-2 w-fit">
            新增材料
          </button>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="stat">
              <p className="text-sm text-slate-500">總成本</p>
              <p className="text-lg font-semibold">61,942</p>
            </div>
            <div className="stat">
              <p className="text-sm text-slate-500">利潤</p>
              <p className="text-lg font-semibold">88,058</p>
            </div>
            <div className="stat">
              <p className="text-sm text-slate-500">每分鐘收入</p>
              <p className="text-lg font-semibold">1,761.2</p>
            </div>
          </div>
        </article>

        <article className="card space-y-6">
          <div>
            <h2 className="text-xl font-bold">子材料 A</h2>
            <p className="text-sm text-slate-500 mt-2">替代方案比較</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">七日成交價格趨勢</p>
            <div className="mt-3 h-28 w-full rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 text-sm">
              趨勢圖預覽
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm">
              <span className="block text-slate-500 mb-2">子材料售價</span>
              <input defaultValue="19800" />
            </label>
            <label className="text-sm">
              <span className="block text-slate-500 mb-2">單次製作時間 (分鐘)</span>
              <input defaultValue="35" />
            </label>
            <label className="text-sm">
              <span className="block text-slate-500 mb-2">製作次數</span>
              <input defaultValue="9" />
            </label>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-3 py-2 text-left">分類</th>
                  <th className="px-3 py-2">HQ</th>
                  <th className="px-3 py-2 text-left">物品名稱</th>
                  <th className="px-3 py-2">數量</th>
                  <th className="px-3 py-2">單價</th>
                  <th className="px-3 py-2">總價</th>
                </tr>
              </thead>
              <tbody>
                {subRows.map((row) => (
                  <tr key={row.name} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-2">
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-1 text-xs">{row.type}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" defaultChecked={row.hq} />
                    </td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2 text-center">{row.qty}</td>
                    <td className="px-3 py-2 text-center">{formatNumber(row.price)}</td>
                    <td className="px-3 py-2 text-center">{formatNumber(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="bg-blue-500 text-white text-sm font-semibold rounded-lg px-4 py-2 w-fit">
            新增材料
          </button>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="stat">
              <p className="text-sm text-slate-500">總成本</p>
              <p className="text-lg font-semibold">5,166</p>
            </div>
            <div className="stat">
              <p className="text-sm text-slate-500">利潤</p>
              <p className="text-lg font-semibold">14,634</p>
            </div>
            <div className="stat">
              <p className="text-sm text-slate-500">每分鐘收入</p>
              <p className="text-lg font-semibold">418.1</p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
