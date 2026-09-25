import CircleHero from '@/components/circle/Hero'
import PerkGrid from '@/components/circle/PerkGrid'
import CompareTable from '@/components/circle/CompareTable'
import MemberWall from '@/components/circle/MemberWall'
import CircleFaq from '@/components/circle/Faq'
import FinalBand from '@/components/circle/FinalBand'

/**
 * Champion's Circle (/circle) — purely presentational supporter-tier page.
 * Gold on near-black, GSAP scroll moments; no checkout wiring.
 */
export default function Circle() {
  return (
    <div>
      <CircleHero />
      <PerkGrid />
      <CompareTable />
      <MemberWall />
      <CircleFaq />
      <FinalBand />
    </div>
  )
}
