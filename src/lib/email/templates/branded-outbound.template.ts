/**
 * Branded outbound HTML — inlined so production/standalone deploys never
 * miss the filesystem template (readFileSync of .html is not always traced).
 * Keep in sync with branded-outbound.html (source of truth for designers).
 */
export const BRANDED_OUTBOUND_HTML = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f9;-webkit-text-size-adjust:100%;">

<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f5f9;font-size:1px;line-height:1px;">{{preheader}}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f9;">
<tr><td align="center" style="padding:32px 12px;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

    <tr><td style="background:#0b0d18;border-radius:14px 14px 0 0;padding:22px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="middle">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td valign="middle" style="padding-right:10px;">
                <img src="{{logo_url}}" width="32" height="32" alt="Delvix" style="display:block;width:32px;height:32px;border:0;border-radius:8px;">
              </td>
              <td valign="middle" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
                Delvix<span style="font-family:'Courier New',Courier,monospace;font-size:10px;font-weight:400;color:#9aa0c3;letter-spacing:2px;">&nbsp;STUDIO</span>
              </td>
            </tr></table>
          </td>
          <td align="right" valign="middle" style="font-family:'Courier New',Courier,monospace;font-size:10px;color:#9aa0c3;letter-spacing:1.5px;">
            <span style="color:#3ddc97;">&#9679;</span>&nbsp;SOFTWARE STUDIO
          </td>
        </tr>
      </table>
    </td></tr>

    <tr><td style="height:3px;line-height:3px;font-size:0;background:#5b63f5;background-image:linear-gradient(90deg,#5b63f5 0%,#5b63f5 70%,#ff6b3d 100%);">&nbsp;</td></tr>

    <tr><td style="background:#ffffff;padding:36px 32px 8px 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1d2033;">

      <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#1d2033;">{{greeting}}</p>

      <div style="font-size:15px;line-height:1.7;color:#3b3f55;">
        {{intro_html}}
      </div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
        <tr><td style="background:#f6f7ff;border:1px solid #e3e5fb;border-left:4px solid #5b63f5;border-radius:10px;padding:18px 20px;">
          <div style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:1.5px;color:#5b63f5;font-weight:bold;padding-bottom:6px;">WHAT WE NOTICED</div>
          <div style="font-size:15px;font-weight:bold;color:#1d2033;line-height:1.5;padding-bottom:4px;">{{finding_title}}</div>
          <div style="font-size:14px;line-height:1.6;color:#555a73;">{{finding_text}}</div>
        </td></tr>
      </table>

      <div style="font-size:15px;line-height:1.7;color:#3b3f55;">
        {{body_html}}
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 30px 0;">
        <tr>
          <td style="padding:0 10px 10px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td align="center" bgcolor="#5b63f5" style="border-radius:999px;">
                <a href="{{cta_url}}" style="display:inline-block;padding:13px 22px;white-space:nowrap;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">{{cta_label}} &rarr;</a>
              </td>
            </tr></table>
          </td>
          <td style="padding:0 0 10px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td align="center" style="border:1px solid #d6d9e8;border-radius:999px;">
                <a href="{{whatsapp_url}}" style="display:inline-block;padding:12px 20px;white-space:nowrap;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#1d2033;text-decoration:none;border-radius:999px;"><span style="color:#25d366;">&#9679;</span>&nbsp;WhatsApp</a>
              </td>
            </tr></table>
          </td>
        </tr>
      </table>

    </td></tr>

    <tr><td style="background:#ffffff;padding:0 32px 32px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #eceef5;">
        <tr><td style="padding-top:22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle" style="padding-right:14px;">
              <img src="{{sender_photo_url}}" width="48" height="48" alt="{{sender_name}}" style="display:block;width:48px;height:48px;border:0;border-radius:50%;">
            </td>
            <td valign="middle" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
              <div style="font-size:15px;font-weight:bold;color:#1d2033;line-height:1.4;">{{sender_name}}</div>
              <div style="font-size:13px;color:#7a7f99;line-height:1.5;">{{sender_title}} &middot; {{company_legal_name}}</div>
              <div style="font-size:13px;line-height:1.6;padding-top:2px;">
                <a href="{{website_url}}" style="color:#5b63f5;text-decoration:none;font-weight:bold;">{{website_label}}</a>
                <span style="color:#c5c8d8;">&nbsp;|&nbsp;</span>
                <a href="{{whatsapp_url}}" style="color:#5b63f5;text-decoration:none;font-weight:bold;white-space:nowrap;">{{whatsapp_display}}</a>
              </div>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="background:#0b0d18;border-radius:0 0 14px 14px;padding:26px 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="font-size:13px;line-height:1.6;color:#c9cce0;padding-bottom:14px;">
          {{footer_services}}
        </td></tr>
        <tr><td style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:1px;color:#7d82a3;padding-bottom:14px;">
          <span style="color:#3ddc97;">&#9679;</span>&nbsp;{{availability_line}}
        </td></tr>
        <tr><td style="border-top:1px solid #23263a;padding-top:14px;font-size:11px;line-height:1.6;color:#7d82a3;">
          {{company_legal_name}} &middot; {{business_address}}<br>
          You're receiving this because we thought our work could help your business.
          <a href="{{unsubscribe_url}}" style="color:#9aa0c3;text-decoration:underline;">Unsubscribe</a>
        </td></tr>
      </table>
    </td></tr>

  </table>

  <img src="{{open_pixel_url}}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0;" />

</td></tr>
</table>
</body>
</html>
`;
