import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

const ITEMS: { q: string; a: string }[] = [
  {
    q: 'Is it pay-to-win?',
    a: 'No. Every perk is cosmetic — nameplate, frame, badge — except the kira luck charm, a modest +2% kira odds bump on scout packs. Match results are decided on the pitch, not at the till.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel in one click and you keep everything until the end of the paid month. No lock-ins, no win-back emails every day.',
  },
  {
    q: 'What happens to my gold nameplate if I cancel?',
    a: "It reverts to the standard white nameplate when your membership lapses. Rejoin any time and the gold comes straight back — your 'since' date is preserved.",
  },
  {
    q: 'Does it work on every cabinet?',
    a: 'Every core cabinet — 2002-03 Serie A through 2013-14 World Clubs — plus event cabinets like the Legends ATLE machine when they rotate in.',
  },
]

/** FAQ accordion — chevron rotates on open, content animates height. */
export default function CircleFaq() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h2 className="text-center font-display text-[28px] font-semibold uppercase tracking-[0.06em] text-wccf-ink">
        Questions
      </h2>
      <div className="mt-8 rounded-panel border border-line bg-panel px-4">
        <Accordion type="single" collapsible>
          {ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-line">
              <AccordionTrigger className="py-3.5 font-sans text-[14px] font-semibold text-wccf-ink hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-[14px] leading-relaxed text-wccf-dim">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
