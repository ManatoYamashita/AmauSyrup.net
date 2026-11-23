import styles from "../styles/Corner.module.css";
import logo from "../assets/amausyrup-logo-white.webp";
import Image from "next/image";

export function Corner() {
    return (
        <div className={styles.wrap}>
            <div className={styles.head}>
                {/* sizes が無いと固有幅 1898px を基準に 1x/2x を選ぶため、モバイルでも
                    w=3840 を要求していた。表示幅は Corner.module.css の .logo に合わせる:
                    〜768px は width: 60vw、それ以上は height: 20vh × 縦横比 1898/889 ≒ 43vh。 */}
                <Image
                    src={logo}
                    alt="logo"
                    className={styles.logo}
                    sizes="(max-width: 768px) 60vw, 43vh"
                ></Image>
                <a href="https://www.youtube.com/@syrupchan0" target="_blank" className={styles.youtube}>
                    <span className={styles.circle1}><p className={styles.yt}>YouTube</p></span>
                </a>
            </div>
            <div className={styles.bottom}>
                <a href="https://twitter.com/syrupchan0/bio" target="_blank" className={styles.xcom}>
                    <span className={styles.circle2}><p className={styles.x}>X</p></span>
                </a>
                <a href="https://syrupchan0.fanbox.cc" target="_blank" className={styles.fanbox}>
                    <span className={styles.circle3}><p className={styles.fb}>fanbox</p></span>
                </a>
            </div>
        </div>
    );
}

export default Corner;