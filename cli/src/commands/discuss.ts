export async function handleDiscuss(surface: string, _command: string): Promise<boolean> {
  if (surface !== 'discuss') return false

  console.log('discuss commands: not yet implemented')
  console.log('planned: listen, say, history')
  return true
}