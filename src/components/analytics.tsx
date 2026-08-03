import Script from "next/script"
import { analyticsEnabled } from "@/data/analytics/ga"

/**
 * ตัวเก็บสถิติการใช้งาน (US-37, PD-027)
 *
 * **ลำดับสำคัญ (BR-USE-05):** สั่งปฏิเสธความยินยอมทุกข้อ **ก่อน** สั่งตั้งค่าเสมอ
 * ถ้าสลับลำดับ คุกกี้จะถูกวางไปแล้วก่อนที่คำสั่งปฏิเสธจะมีผล
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
  analytics_storage: 'denied'
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
