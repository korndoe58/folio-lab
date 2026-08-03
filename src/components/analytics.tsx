import Script from "next/script"
import { analyticsEnabled } from "@/data/analytics/ga"
import { CONSENT_REQUIRED_REGIONS } from "@/data/analytics/regions"


/**
 * ตัวเก็บสถิติการใช้งาน (US-37 · US-38 · PD-027 · PD-028)
 *
 * **ค่าเริ่มต้นแยกตามภูมิภาค (BR-USE-20):** เขตที่กฎหมายบังคับให้ขอก่อน → ปฏิเสธทุกข้อ ·
 * ที่เหลือ → อนุญาตเฉพาะการวัดผลการใช้งาน · **โฆษณาปฏิเสธทุกที่เสมอ** เพราะเว็บนี้ไม่ทำโฆษณาเลย
 * จึงไม่มีเหตุผลให้ขอสิทธิ์นั้นแม้แต่ที่เดียว
 *
 * ที่ต้องแยกเพราะการปฏิเสธทุกที่ทำให้ข้อมูลไปถึงปลายทางแต่**ไม่ถูกนับเข้ารายงานเลย** —
 * วัดแล้วเห็นศูนย์ทั้งที่ส่งสำเร็จ (PD-028)
 *
 * **ลำดับสำคัญ (BR-USE-05):** สั่งความยินยอม **ก่อน** สั่งตั้งค่าเสมอ
 * ถ้าสลับลำดับ คุกกี้จะถูกวางไปแล้วก่อนที่คำสั่งจะมีผล
 *
 * ไม่วาดอะไรเลยเมื่อปิดอยู่ — เครื่องของผู้พัฒนาที่ไม่ได้ตั้งค่า และชุดทดสอบทั้งชุด
 * จะไม่มีสคริปต์นี้อยู่ในหน้าเลย ไม่ใช่แค่ไม่ยิง (BR-USE-03, BR-USE-04)
 */
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID
  if (!analyticsEnabled() || !id) return null

  return (
    <>
      {/* โหลดแบบไม่ขวางการแสดงผล — หน้าผลลัพธ์ต้องอยู่ในงบเวลาเดิม (BR-USE-08) */}
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="analytics-init" strategy="afterInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  region: ${JSON.stringify(CONSENT_REQUIRED_REGIONS)}
});
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'granted'
});
gtag('js', new Date());
gtag('config', '${id}', {
  page_location: location.origin + location.pathname,
  page_referrer: document.referrer ? document.referrer.split('?')[0] : ''
});
        `}
      </Script>
    </>
  )
}
