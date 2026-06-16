export default function PageSkeleton() {
  return (
    <div className="max-w-xl md:max-w-2xl mx-auto w-full min-h-dvh pb-20 md:pt-14 px-4">
      <div className="py-4 flex flex-col gap-4">
        <div className="h-6 w-32 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
