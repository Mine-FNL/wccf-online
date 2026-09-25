/**
 * WCCF match engine — public API.
 *
 * Lobby (all visitors see the same match):
 *   const sync = cabinetNow(cabinet.id)
 *   const tl = useMemo(() => createMatch(sync.seed, home, away), [sync.seed])
 *   const [state, setState] = useState(() => stateAt(tl, sync.clock))
 *   useEffect(() => {
 *     const id = setInterval(() => setState(stateAt(tl, cabinetNow(cabinet.id).clock)), 1000)
 *     return () => clearInterval(id)
 *   }, [tl, cabinet.id])
 *
 * Theatre replay / seat flow: createMatch(mySeed, home, away), scrub with
 * stateAt(tl, t).
 */
export * from './types'
export * from './sim'
export * from './commentary'
