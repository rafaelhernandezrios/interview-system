import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Streams the acceptance letter PDF to res.
 * @param {object} res - Express response
 * @param {object} user - User document (plain or mongoose)
 * @param {object} application - Application document (plain or mongoose)
 * @param {string} programType - Program type: 'MIRI' or 'FIJSE' (Future Innovators Japan Selection Entry)
 */
export function streamAcceptanceLetterPdf(res, user, application, programType = 'MIRI') {
  if (programType === 'FIJSE') {
    return streamFIJSEAcceptanceLetterPdf(res, user, application);
  }
  return streamMIRIAcceptanceLetterPdf(res, user, application);
}

/**
 * Streams the MIRI acceptance letter PDF to res.
 * @param {object} res - Express response
 * @param {object} user - User document (plain or mongoose)
 * @param {object} application - Application document (plain or mongoose)
 */
function streamMIRIAcceptanceLetterPdf(res, user, application) {
  const fullName =
    application?.firstName && application?.lastName
      ? `${application.firstName} ${application.lastName}`
      : user.name;

  const regCode =
    user.digitalId ||
    `MIRI-2026-01-${String(user._id).slice(-3).padStart(3, "0")}`;

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 60, bottom: 60, left: 72, right: 72 },
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Acceptance_Letter_${fullName.replace(/\s+/g, "_")}.pdf"`
  );
  doc.pipe(res);

  const logoPath = path.join(__dirname, "..", "..", "frontend", "src", "assets", "logo.png");
  const headerY = 60;
  const textWidth = doc.page.width - 144;

  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Mirai Innovation Research Institute", 72, headerY)
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#444444")
    .text("[Headquarters] Minamihonmachi 2-3-12 Edge Honmachi")
    .text("Chuo-ku, Osaka-shi, Osaka, Japan. 5410054")
    .text("contact@mirai-innovation-lab.com");

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, doc.page.width - 72 - 80, headerY - 10, { width: 80 });
  }

  const today = new Date();
  const day = today.getDate();
  const suffix =
    day === 1 || day === 21 || day === 31
      ? "st"
      : day === 2 || day === 22
        ? "nd"
        : day === 3 || day === 23
          ? "rd"
          : "th";
  const formattedDate = today
    .toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    .replace(/\d+/, day + suffix);

  doc
    .fillColor("black")
    .fontSize(11)
    .font("Helvetica")
    .text(formattedDate, 72, headerY + 75, { align: "right", width: textWidth });

  doc.moveDown(0.5);
  doc
    .font("Helvetica")
    .fontSize(11)
    .text(
      "Subject: Official Final Decision for Mirai Innovation Research Immersion (MIRI) Program 2026",
      { align: "right", width: textWidth }
    );
  doc.moveDown(1.5);

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(`Dear ${fullName},`, 72, doc.y, { align: "left" });
  doc.moveDown(1);

  const bodyOptions = { align: "justify", width: textWidth, lineGap: 2 };

  doc
    .font("Helvetica")
    .text(
      "On behalf of the evaluation committee of the Mirai Innovation Research Immersion Program (MIRI) 2026 at the Mirai Innovation Research Institute, it is a great pleasure to inform you that you have been ",
      { ...bodyOptions, continued: true }
    )
    .font("Helvetica-Bold")
    .text("accepted ", { continued: true })
    .font("Helvetica")
    .text(
      " to participate in our short-term academic immersion program in Osaka, Japan, for a duration of ",
      { continued: true }
    )
    .font("Helvetica-Bold")
    .text("4 to 12 weeks.", { continued: false });
  doc.moveDown(0.8);

  const currentYear = today.getFullYear();

  doc
    .font("Helvetica")
    .text(
      `Your acceptance is valid for the year ${currentYear}, and your participation must begin after January ${currentYear} and conclude before December ${currentYear}. The exact starting date is flexible, allowing you to select the period that best fits your academic or professional schedule. Below you will find your `,
      { align: "justify", width: textWidth, continued: true }
    )
    .font("Helvetica-Bold")
    .text("registration code ", {
      continued: true,
      align: "justify",
      width: textWidth,
    })
    .font("Helvetica")
    .text(
      "for the program. Please use the registration link provided to select your preferred participation dates and duration:",
      { align: "justify", width: textWidth }
    );

  doc.moveDown(0.8);
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").text(`Registration Code: ${regCode}`, {
    width: textWidth,
  });
  doc.font("Helvetica").text("", { continued: false });
  doc.font("Helvetica").text("", { continued: false });
  doc
    .font("Helvetica-Bold")
    .text("Registration Link:", { continued: true, width: textWidth });
  doc.font("Helvetica").text(" ", { continued: true });
  doc
    .fillColor("blue")
    .text("https://www.mirai-innovation-lab.com/miri-program-registration-form", {
      link: "https://www.mirai-innovation-lab.com/miri-program-registration-form",
      continued: false,
    })
    .fillColor("black");

  doc.moveDown(0.8);

  doc
    .font("Helvetica")
    .text("To confirm your participation, please ensure you ", {
      ...bodyOptions,
      continued: true,
    })
    .font("Helvetica-Bold")
    .text("complete your registration within 1 week", { continued: false })
    .text(" after receiving this acceptance letter.", bodyOptions);

  doc.moveDown(0.8);

  doc
    .font("Helvetica")
    .text(
      "After completing your registration, you will receive detailed information regarding the ",
      { align: "justify", width: textWidth, continued: true }
    )
    .font("Helvetica-Bold")
    .text("program venue, logistics, and preparation guidelines", {
      align: "justify",
      width: textWidth,
      continued: true,
    })
    .font("Helvetica")
    .text(
      ". Additionally, you will be scheduled for a ",
      { ...bodyOptions, continued: true }
    )
    .font("Helvetica-Bold")
    .text("new online meeting", { ...bodyOptions, continued: true })
    .font("Helvetica")
    .text(
      ", where we will discuss your potential project, provide guidance on how to prepare and acquire the necessary skills before beginning your MIRI training, and answer any questions you may have regarding your upcoming travel to Japan.",
      { ...bodyOptions, continued: false }
    );

  doc.moveDown(0.8);

  doc
    .font("Helvetica")
    .text(
      "We are excited to welcome you to Japan—a place where innovation, creativity, and cultural enrichment come together in inspiring ways. We trust that your experience at Mirai Innovation will expand your vision, strengthen your skills, and open meaningful opportunities for your professional and academic future.",
      bodyOptions
    );

  doc.moveDown(0.8);
  doc.text(
    "If you have any questions or require further assistance, please feel free to contact us.",
    bodyOptions
  );

  doc.moveDown(1.5);
  const centerTextX = (doc.page.width - textWidth) / 2;
  const cierreY = doc.y;

  const hankoPath = path.join(__dirname, "..", "public", "images", "hanko.png");
  const hankoImgSize = 54;
  const hankoImgOffsetY = 17;
  const hankoOffsetRight = 85;
  const hankoCenterX =
    doc.page.width / 2 + hankoOffsetRight - hankoImgSize / 2;

  if (fs.existsSync(hankoPath)) {
    const hankoCenterY = cierreY + hankoImgOffsetY;
    doc.image(hankoPath, hankoCenterX, hankoCenterY, {
      width: hankoImgSize,
      height: hankoImgSize,
    });
  }

  const cierreTextYOffset = 10;
  doc
    .fillColor("black")
    .font("Helvetica")
    .fontSize(11)
    .text("Evaluation Committee", centerTextX, cierreY + cierreTextYOffset, {
      align: "center",
      width: textWidth,
    });

  doc
    .font("Helvetica-Bold")
    .text("Mirai Innovation Research Institute", centerTextX, doc.y, {
      align: "center",
      width: textWidth,
    });

  const footerY = doc.page.height - 100;

  doc
    .strokeColor("#d1d5db")
    .lineWidth(0.5)
    .moveTo(72, footerY - 20)
    .lineTo(doc.page.width - 72, footerY - 20)
    .stroke();

  doc.fontSize(7.5).font("Helvetica").fillColor("#6b7280");
  doc.text(
    "[Lab Address] ATC blg, ITM sec. 6th floor Rm. M-1-3 Nankoukita 2-1-10, Suminoe-ku, Osaka, Japan. 559-0034.",
    72,
    footerY,
    { align: "center", width: textWidth }
  );
  doc.text("Tel.: +81 06-6616-7897", 72, footerY + 12, {
    align: "center",
    width: textWidth,
  });
  doc.text("www.mirai-innovation-lab.com", 72, footerY + 24, {
    align: "center",
    width: textWidth,
  });

  doc.end();
}

/**
 * Streams the Future Innovators Japan Selection Entry (FIJSE) acceptance letter PDF to res.
 * @param {object} res - Express response
 * @param {object} user - User document (plain or mongoose)
 * @param {object} application - Application document (plain or mongoose)
 */
function streamFIJSEAcceptanceLetterPdf(res, user, application) {
  const fullName =
    application?.firstName && application?.lastName
      ? `${application.firstName} ${application.lastName}`
      : user.name;

  const regCode =
    user.digitalId ||
    `MIRI-2026-01-${String(user._id).slice(-3).padStart(3, "0")}`;

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 60, bottom: 60, left: 72, right: 72 },
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Acceptance_Letter_FIJSE_${fullName.replace(/\s+/g, "_")}.pdf"`
  );
  doc.pipe(res);

  const logoPath = path.join(__dirname, "..", "..", "frontend", "src", "assets", "logo.png");
  const headerY = 60;
  const textWidth = doc.page.width - 144;

  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Mirai Innovation Research Institute", 72, headerY)
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#444444")
    .text("[Headquarters] Minamihonmachi 2-3-12 Edge Honmachi")
    .text("Chuo-ku, Osaka-shi, Osaka, Japan. 5410054")
    .text("contact@mirai-innovation-lab.com");

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, doc.page.width - 72 - 80, headerY - 10, { width: 80 });
  }

  const today = new Date();
  const day = today.getDate();
  const suffix =
    day === 1 || day === 21 || day === 31
      ? "st"
      : day === 2 || day === 22
        ? "nd"
        : day === 3 || day === 23
          ? "rd"
          : "th";
  const formattedDate = today
    .toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    .replace(/\d+/, day + suffix);

  doc
    .fillColor("black")
    .fontSize(11)
    .font("Helvetica")
    .text(formattedDate, 72, headerY + 75, { align: "right", width: textWidth });

  doc.moveDown(0.5);
  doc
    .font("Helvetica")
    .fontSize(11)
    .text(
      "Subject: Official Acceptance – Mirai Innovation Research Immersion (MIRI) Program 2026 in Osaka Japan",
      { align: "right", width: textWidth }
    );
  doc.moveDown(1.5);

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(`Dear ${fullName},`, 72, doc.y, { align: "left" });
  doc.moveDown(1);

  const bodyOptions = { align: "justify", width: textWidth, lineGap: 2 };

  // First paragraph: Thank you for participation
  doc
    .font("Helvetica")
    .text(
      "Thank you for your participation in the Future Innovators Japan Selection Entry. We truly appreciate the time, effort, and commitment you demonstrated throughout the process.",
      bodyOptions
    );
  doc.moveDown(0.8);

  // Second paragraph: Official acceptance to MIRI program
  doc
    .font("Helvetica")
    .text(
      "On behalf of the evaluation committee of the Mirai Innovation Research Immersion Program (MIRI) 2026 at the Mirai Innovation Research Institute, we are pleased to extend this official acceptance letter inviting you to participate in our short-term academic immersion program in Osaka, Japan, for a duration of ",
      { ...bodyOptions, continued: true }
    )
    .font("Helvetica-Bold")
    .text("4 to 12 weeks.", { continued: false });
  doc.moveDown(0.8);

  // Third paragraph: Recognition and scholarship offer
  doc
    .font("Helvetica")
    .text(
      "Although you were not selected as the recipient of the Full Scholarship in the Future Innovators Japan Selection Entry, we would like to express our recognition of your strong academic potential, talent, and performance throughout the evaluation process. Based on your profile and demonstrated capabilities, we are pleased to offer you this opportunity to join the MIRI program with a ",
      { ...bodyOptions, continued: true }
    )
    .font("Helvetica-Bold")
    .text("partial tuition scholarship of 15%", { ...bodyOptions, continued: true })
    .font("Helvetica")
    .text(".", { continued: false });
  doc.moveDown(0.8);

  // Fourth paragraph: Acceptance validity
  doc
    .font("Helvetica")
    .text(
      "Your acceptance is valid for the year 2026, and your participation must begin after February 2026 and conclude before December 2026. The exact starting date is flexible, allowing you to select the period that best fits your academic or professional schedule.",
      bodyOptions
    );
  doc.moveDown(0.8);

  // Program Fees section
  doc
    .font("Helvetica-Bold")
    .text("Program Fees (Before and After Scholarship)", {
      width: textWidth,
    });
  doc.moveDown(0.4);
  doc.font("Helvetica").text("Current tuition rates:", bodyOptions);
  doc.moveDown(0.3);
  doc.text("• USD 350 per week for programs lasting 4–6 weeks", bodyOptions);
  doc.text("• USD 300 per week for programs lasting 7–12 weeks", bodyOptions);
  doc.moveDown(0.4);
  doc.text("With your 15% tuition scholarship, the updated rates become:", bodyOptions);
  doc.moveDown(0.3);
  doc.text("• USD 297.50 per week for programs lasting 4–6 weeks", bodyOptions);
  doc.text("• USD 255.00 per week for programs lasting 7–12 weeks", bodyOptions);
  doc.moveDown(0.4);
  doc
    .font("Helvetica-Bold")
    .text("", { continued: true })
    .font("Helvetica")
    .text(" The 15% scholarship applies only to tuition fees and does not apply to the program registration fee of USD 250.", bodyOptions);
  doc.moveDown(0.3);
  doc
    .font("Helvetica-Bold")
    .text("", { continued: true })
    .font("Helvetica")
    .text(" Please note that flights, accommodation, meals, visa costs, insurance, and personal expenses during your stay in Japan are not included in the program tuition.", bodyOptions);
  doc.moveDown(0.8);

  // Registration Code and Link
  doc
    .font("Helvetica")
    .text(
      "Below you will find your personal registration code and link to confirm your participation:",
      bodyOptions
    );
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").text(`Registration Code: ${regCode}`, {
    width: textWidth,
  });
  doc.moveDown(0.3);
  doc
    .font("Helvetica-Bold")
    .text("Registration Link:", { continued: true, width: textWidth });
  doc.font("Helvetica").text(" ", { continued: true });
  doc
    .fillColor("blue")
    .text("https://www.mirai-innovation-lab.com/miri-program-registration-form", {
      link: "https://www.mirai-innovation-lab.com/miri-program-registration-form",
      continued: false,
    })
    .fillColor("black");
  doc.moveDown(0.8);

  // Important Deadline
  doc
    .font("Helvetica-Bold")
    .text("Important Deadline", {
      width: textWidth,
    });
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .text(
      "To confirm your participation, please complete your registration no later than February 13th to secure your place in the program.",
      bodyOptions
    );
  doc.moveDown(0.8);

  // Information Session
  doc
    .font("Helvetica-Bold")
    .text("Information Session", {
      width: textWidth,
    });
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .text(
      "There will be an online information session for registered participants on February 16th, 10 AM JST. After completing your registration, you will receive the Zoom link and further details for this session.",
      bodyOptions
    );
  doc.moveDown(0.4);
  doc
    .font("Helvetica")
    .text(
      "During the information session, you will also receive detailed information regarding the ",
      { align: "justify", width: textWidth, continued: true }
    )
    .font("Helvetica-Bold")
    .text("program venue, logistics, and preparation guidelines", {
      align: "justify",
      width: textWidth,
      continued: true,
    })
    .font("Helvetica")
    .text(
      ". Additionally, After the session, you will be scheduled for an online meeting where we will discuss your potential project, provide guidance on how to prepare and acquire the necessary skills before beginning your MIRI training, and answer any questions you may have regarding your upcoming travel to Japan.",
      { ...bodyOptions, continued: false }
    );
  doc.moveDown(0.8);

  // Closing paragraph
  doc
    .font("Helvetica")
    .text(
      "We are excited to welcome you to Japan—a place where innovation, creativity, and cultural enrichment come together in inspiring ways. We trust that your experience at Mirai Innovation will expand your vision, strengthen your skills, and open meaningful opportunities for your professional and academic future.",
      bodyOptions
    );

  doc.moveDown(0.8);
  doc.text(
    "If you have any questions or require further assistance, please feel free to contact us.",
    bodyOptions
  );

  doc.moveDown(1.5);
  const centerTextX = (doc.page.width - textWidth) / 2;
  const cierreY = doc.y;

  const hankoPath = path.join(__dirname, "..", "public", "images", "hanko.png");
  const hankoImgSize = 54;
  const hankoImgOffsetY = 17;
  const hankoOffsetRight = 85;
  const hankoCenterX =
    doc.page.width / 2 + hankoOffsetRight - hankoImgSize / 2;

  if (fs.existsSync(hankoPath)) {
    const hankoCenterY = cierreY + hankoImgOffsetY;
    doc.image(hankoPath, hankoCenterX, hankoCenterY, {
      width: hankoImgSize,
      height: hankoImgSize,
    });
  }

  const cierreTextYOffset = 10;
  doc
    .fillColor("black")
    .font("Helvetica")
    .fontSize(11)
    .text("Evaluation Committee", centerTextX, cierreY + cierreTextYOffset, {
      align: "center",
      width: textWidth,
    });

  doc
    .font("Helvetica-Bold")
    .text("Mirai Innovation Research Institute", centerTextX, doc.y, {
      align: "center",
      width: textWidth,
    });

  const footerY = doc.page.height - 100;

  doc
    .strokeColor("#d1d5db")
    .lineWidth(0.5)
    .moveTo(72, footerY - 20)
    .lineTo(doc.page.width - 72, footerY - 20)
    .stroke();

  doc.fontSize(7.5).font("Helvetica").fillColor("#6b7280");
  doc.text(
    "[Lab Address] ATC blg, ITM sec. 6th floor Rm. M-1-3 Nankoukita 2-1-10, Suminoe-ku, Osaka, Japan. 559-0034.",
    72,
    footerY,
    { align: "center", width: textWidth }
  );
  doc.text("Tel.: +81 06-6616-7897", 72, footerY + 12, {
    align: "center",
    width: textWidth,
  });
  doc.text("www.mirai-innovation-lab.com", 72, footerY + 24, {
    align: "center",
    width: textWidth,
  });

  doc.end();
}
