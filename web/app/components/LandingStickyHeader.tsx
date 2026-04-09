"use client";

import styles from "../landing.module.css";

const LOGO_SRC = "/novus-logo.png";

type Props = {
  applicationUrl: string;
  applyLabel: string;
  preferredLenderSub: string;
  langToggleLabel: string;
  onToggleLanguage: () => void;
};

export function LandingStickyHeader({
  applicationUrl,
  applyLabel,
  preferredLenderSub,
  langToggleLabel,
  onToggleLanguage,
}: Props) {
  return (
    <header className={styles.stickyHeader} role="banner">
      <div className={styles.stickyInner}>
        <div className={styles.stickyLeft}>
          <img
            src={LOGO_SRC}
            alt="Novus Home Mortgage"
            className={styles.stickyLogo}
            width={220}
            height={40}
          />
          <div className={styles.stickyNameBlock}>
            <span className={styles.stickyOfficerName}>Kari Pastrana</span>
            <span className={styles.stickyOfficerSub}>{preferredLenderSub}</span>
          </div>
        </div>
        <div className={styles.stickyActions}>
          <button type="button" className={styles.stickyLangToggle} onClick={onToggleLanguage}>
            {langToggleLabel}
          </button>
          <a href={applicationUrl} className={styles.stickyApply}>
            {applyLabel}
          </a>
        </div>
      </div>
    </header>
  );
}
