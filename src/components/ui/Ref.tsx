import styles from './Ref.module.css'

export function Ref({ value }: { value: string }) {
  return <span className={styles.ref}>{value}</span>
}
