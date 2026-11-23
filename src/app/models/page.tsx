import ModelViewerClient from '@/components/dev/ModelViewerClient'

/**
 * Dev page for checking optimized models (Stage 2) with the site's lighting.
 * /models?m=<name>&az=<deg>&el=<deg>&fov=<deg>&dist=<k>&ty=<0..1>
 */
export default function ModelsPage() {
  return (
    <main className="stage">
      <ModelViewerClient />
    </main>
  )
}
