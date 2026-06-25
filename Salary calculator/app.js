    // Helpers
    function formatPHP(amount) { return "₱" + (isNaN(amount) ? 0 : amount).toFixed(2); }
    function confettiBurst() {
      for (let i = 0; i < 24; i++) {
        const c = document.createElement("div");
        c.className = "confetti";
        const colors = ["#ffd54f", "#4fc3f7", "#ff8a80", "#b388ff", "#69f0ae", "#ffcc80"];
        c.style.background = colors[Math.floor(Math.random() * colors.length)];
        c.style.left = Math.random() * 100 + "vw";
        c.style.transform = "translateY(-20px) rotate(" + Math.random() * 360 + "deg)";
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 2200);
      }
    }

    const weeksPerMonth = 4.333;

    // Calculate
    document.getElementById("salaryForm").addEventListener("submit", function (e) {
      e.preventDefault();

      const rate = parseFloat(document.getElementById("hourly").value) || 0;
      const regH = parseFloat(document.getElementById("regularHours").value) || 0;
      const otH = parseFloat(document.getElementById("overtimeHours").value) || 0;
      const otM = parseFloat(document.getElementById("otMultiplier").value) || 1.25;
      const holidayH = parseFloat(document.getElementById("holidayHours").value) || 0;
      const holidayRate = parseFloat(document.getElementById("holidayRate").value) || 2.0;
      const nightH = parseFloat(document.getElementById("nightHours").value) || 0;
      const nightPct = parseFloat(document.getElementById("nightPercent").value) || 0.10;
      const allowance = parseFloat(document.getElementById("allowance").value) || 0;
      const bonus = parseFloat(document.getElementById("bonus").value) || 0;

      // Weekly components
      const regularWeekly = rate * regH;
      const overtimeWeekly = rate * otH * otM;
      const holidayWeekly = rate * holidayH * holidayRate;
      const nightWeekly = rate * nightH * nightPct;
      const weeklyGross = regularWeekly + overtimeWeekly + holidayWeekly + nightWeekly;

      const monthlyGross = weeklyGross * weeksPerMonth + allowance + bonus;
      const annualGross = monthlyGross * 12;

      // Official deductions (based on monthly basic from regular hours)
      const monthlyBasic = regularWeekly * weeksPerMonth;
      const msc = Math.min(Math.max(monthlyBasic, 5000), 35000);
      const sss = msc * 0.075;
      const phBase = Math.min(Math.max(monthlyBasic, 10000), 100000);
      const philhealth = phBase * 0.05 / 2;
      const pagibig = Math.min(monthlyBasic * 0.02, 200);

      const taxable = monthlyGross - (sss + philhealth + pagibig);
      let tax = 0;
      if (taxable <= 20833) tax = 0;
      else if (taxable <= 33333) tax = (taxable - 20833) * 0.20;
      else if (taxable <= 66667) tax = 2500 + (taxable - 33333) * 0.25;
      else if (taxable <= 166667) tax = 10833 + (taxable - 66667) * 0.30;
      else if (taxable <= 666667) tax = 40833 + (taxable - 166667) * 0.32;
      else tax = 200833 + (taxable - 666667) * 0.35;

      const monthlyNet = monthlyGross - (sss + philhealth + pagibig + tax);
      const weeklyNet = monthlyNet / weeksPerMonth;
      const thirteenth = monthlyBasic; // basic only
      const annualNet = monthlyNet * 12 + thirteenth;

      // Show results
      document.getElementById("output").classList.remove("hidden");
      document.getElementById("weeklyGross").textContent = formatPHP(weeklyGross);
      document.getElementById("monthlyGross").textContent = formatPHP(monthlyGross);
      document.getElementById("annualGross").textContent = formatPHP(annualGross);
      document.getElementById("weeklyNet").textContent = formatPHP(weeklyNet);
      document.getElementById("monthlyNet").textContent = formatPHP(monthlyNet);
      document.getElementById("annualNet").textContent = formatPHP(annualNet);

      document.getElementById("details").innerHTML =
        "Regular weekly: " + formatPHP(regularWeekly) + "<br>" +
        "Overtime weekly: " + formatPHP(overtimeWeekly) + "<br>" +
        "Holiday weekly: " + formatPHP(holidayWeekly) + "<br>" +
        "Night diff weekly: " + formatPHP(nightWeekly) + "<br>" +
        "Allowances: " + formatPHP(allowance) + "<br>" +
        "Bonuses: " + formatPHP(bonus) + "<br>" +
        "SSS (EE): " + formatPHP(sss) + "<br>" +
        "PhilHealth (EE): " + formatPHP(philhealth) + "<br>" +
        "Pag‑IBIG (EE): " + formatPHP(pagibig) + "<br>" +
        "Tax (withholding): " + formatPHP(tax) + "<br>" +
        "Net monthly: " + formatPHP(monthlyNet) + "<br>" +
        "13th month (basic only): " + formatPHP(thirteenth) + "<br>" +
        "Annual net (incl. 13th): " + formatPHP(annualNet);

      confettiBurst();
    });

    // Reset button
    document.getElementById("resetBtn").addEventListener("click", function () {
      document.getElementById("salaryForm").reset();
      document.getElementById("output").classList.add("hidden");
    });

    // Presets
    document.getElementById("preset40h").addEventListener("click", () => {
      document.getElementById("hourly").value = 120;
      document.getElementById("regularHours").value = 40;
    });
    document.getElementById("addOT").addEventListener("click", () => {
      const el = document.getElementById("overtimeHours");
      el.value = (parseFloat(el.value) || 0) + 5;
    });
    document.getElementById("holidayMode").addEventListener("click", () => {
      document.getElementById("holidayHours").value = 8;
      document.getElementById("holidayRate").value = 2.0;
    });
    document.getElementById("nightShift").addEventListener("click", () => {
      document.getElementById("nightHours").value = 8;
      document.getElementById("nightPercent").value = 0.10;
    });
    document.getElementById("surpriseBonus").addEventListener("click", () => {
      document.getElementById("bonus").value = Math.floor(Math.random() * 5000) + 500; // ₱500–₱5500
      confettiBurst();
    });

    // Breakdown toggle
    document.getElementById("toggleBreakdown").addEventListener("click", () => {
      document.getElementById("breakdown").classList.toggle("hidden");
    });

    // View toggles (hide/show tiles)
    function showView(view) {
      const ids = {
        weekly: ["tileWeeklyGross", "tileWeeklyNet"],
        monthly: ["tileMonthlyGross", "tileMonthlyNet"],
        annual: ["tileAnnualGross", "tileAnnualNet"]
      };
      const all = ["tileWeeklyGross", "tileWeeklyNet", "tileMonthlyGross", "tileMonthlyNet", "tileAnnualGross", "tileAnnualNet"];
      all.forEach(id => document.getElementById(id).style.display = "none");
      ids[view].forEach(id => document.getElementById(id).style.display = "block");
    }
    document.getElementById("viewWeekly").addEventListener("click", () => showView("weekly"));
    document.getElementById("viewMonthly").addEventListener("click", () => showView("monthly"));
    document.getElementById("viewAnnual").addEventListener("click", () => showView("annual"));
    // Default: show all
    showView("weekly");
    document.getElementById("tileMonthlyGross").style.display = "block";
    document.getElementById("tileMonthlyNet").style.display = "block";
    document.getElementById("tileAnnualGross").style.display = "block";
    document.getElementById("tileAnnualNet").style.display = "block";

    // Print
    document.getElementById("printBtn").addEventListener("click", () => window.print());
