/* ============================================================
   SUMMAZ ESCAPE — Booking Form Logic
   ============================================================ */

const STEPS = 7;
const ADULT_PRICE  = 180;
const CHILD_PRICE  = 115;

/* Booking state */
let state = {
  adults:          1,
  children:        0,
  date:            '',
  name:            '',
  email:           '',
  phone:           '',
  addons:          [],
  notes:           '',
  policyAccepted:  false,
  paymentMethod:   '',
  honeypot:        '',
  currentStep:     1,
  reference:       '',
  total:           0
};

/* ── Utility ────────────────────────────────────────────── */
function calcTotal() {
  return (state.adults * ADULT_PRICE) + (state.children * CHILD_PRICE);
}

function formatMoney(n) {
  return '$' + n.toLocaleString();
}

/* Returns today's date string (YYYY-MM-DD) in Bahamas Eastern time */
function todayInBahamas() {
  const now = new Date();
  const bahamasOffset = -4; // EDT (Bahamas observes same as US Eastern)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const bahamas = new Date(utc + (3600000 * bahamasOffset));
  const y = bahamas.getFullYear();
  const m = String(bahamas.getMonth() + 1).padStart(2, '0');
  const d = String(bahamas.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* ── Nav scroll handling ────────────────────────────────── */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 40) {
    nav.classList.remove('nav--transparent');
    nav.classList.add('nav--solid');
  } else {
    nav.classList.remove('nav--solid');
    nav.classList.add('nav--transparent');
  }
}, { passive: true });

/* ── Anchor nav active section tracking + auto-scroll ───── */
(function() {
  const sections = ['overview','included','pricing','extras','location','faq','kids','experience','reels','gallery','reviews'];
  const anchors  = document.querySelectorAll('.anchor-nav__link[data-section]');
  if (!anchors.length) return;

  function scrollNavToLink(el) {
    const strip = el.parentElement;
    if (!strip) return;
    const sRect = strip.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const target = strip.scrollLeft + (eRect.left - sRect.left) - (sRect.width / 2) + (eRect.width / 2);
    strip.scrollTo({ left: target, behavior: 'smooth' });
  }

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        anchors.forEach(a => {
          const isActive = a.dataset.section === id;
          a.classList.toggle('is-active', isActive);
          if (isActive) scrollNavToLink(a);
        });
      }
    });
  }, { rootMargin: '-120px 0px -60% 0px' });

  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) obs.observe(el);
  });
})();

/* ── Sidebar booking widget ─────────────────────────────── */
(function() {
  const today = todayInBahamas();
  const wDate = document.getElementById('widgetDate');
  if (wDate) { wDate.min = today; }
  updateSidebarMinusButtons();
})();

function sidebarDateChange(val) {
  state.date = val;
}

function sidebarCount(field, delta) {
  const newVal = Math.max(0, state[field] + delta);
  if (field === 'adults' && newVal < 0) return;
  state[field] = newVal;
  const countEl = document.getElementById(field === 'adults' ? 'wAdultCount' : 'wChildCount');
  if (countEl) countEl.textContent = newVal;
  updateSidebarTotal();
  updateSidebarMinusButtons();
  updateMobileBarTotal();
}

function updateSidebarTotal() {
  const t = calcTotal();
  const el = document.getElementById('wTotal');
  if (el) el.textContent = formatMoney(t);
}

function updateMobileBarTotal() {
  const t = calcTotal();
  const el = document.getElementById('mobileBarTotal');
  if (el) el.textContent = formatMoney(t) + ' est.';
}

function updateSidebarMinusButtons() {
  const am = document.getElementById('wAdultMinus');
  const cm = document.getElementById('wChildMinus');
  if (am) am.disabled = state.adults <= 0;
  if (cm) cm.disabled = state.children <= 0;
}

function openBookingFromSidebar() {
  // Pull date from sidebar input if not already set
  const wDate = document.getElementById('widgetDate');
  if (wDate && wDate.value) state.date = wDate.value;
  openBooking();
}

/* ── Modal open / close ─────────────────────────────────── */
let previousFocus = null;
let _formOpenedAt = 0;

function openBooking() {
  _formOpenedAt = Date.now();
  previousFocus = document.activeElement;
  // Preserve counts from sidebar, only reset non-sidebar fields
  const savedAdults   = state.adults;
  const savedChildren = state.children;
  const savedDate     = state.date;
  resetState();
  state.adults   = savedAdults;
  state.children = savedChildren;
  state.date     = savedDate;
  state.currentStep = 1;
  updateModalProgress(1);
  renderStep(1);
  document.getElementById('bookingModal').classList.add('is-open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const first = document.querySelector('#modalPanel button, #modalPanel input');
    if (first) first.focus();
  }, 350);
}

function closeBooking() {
  document.getElementById('bookingModal').classList.remove('is-open');
  document.body.style.overflow = '';
  if (previousFocus) previousFocus.focus();
  // Sync sidebar DOM to whatever counts are in state after modal changes
  var wAdult = document.getElementById('wAdultCount');
  var wChild = document.getElementById('wChildCount');
  if (wAdult) wAdult.textContent = state.adults;
  if (wChild) wChild.textContent = state.children;
  updateSidebarTotal();
  updateSidebarMinusButtons();
  updateMobileBarTotal();
}

/* Close on overlay click */
document.getElementById('bookingModal').addEventListener('click', function(e) {
  if (e.target === this) closeBooking();
});

/* Close on Escape */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && document.getElementById('bookingModal').classList.contains('is-open')) {
    closeBooking();
  }
});

function resetState() {
  state.adults         = 1;
  state.children       = 0;
  state.date           = '';
  state.name           = '';
  state.email          = '';
  state.phone          = '';
  state.addons         = [];
  state.notes          = '';
  state.policyAccepted = false;
  state.paymentMethod  = '';
  state.honeypot       = '';
  state.reference      = '';
  state.total          = 0;
}

/* ── Progress ────────────────────────────────────────────── */
const STEP_LABELS = ['How many guests?', 'Pick your date', 'Your details', 'Optional extras', 'Waiver & policies', 'Payment method', 'Review & confirm'];
const STEP_SHORT  = ['Guests', 'Date', 'Details', 'Extras', 'Waiver', 'Payment', 'Review'];

function updateModalProgress(step) {
  const fill = document.getElementById('modalProgressFill');
  if (fill) fill.style.width = ((step / STEPS) * 100) + '%';
  const counter = document.getElementById('modalStepCounter');
  if (counter) counter.textContent = `Step ${step} of ${STEPS} · ${STEP_SHORT[step - 1]}`;
  const title = document.getElementById('modalStepTitle');
  if (title) title.textContent = STEP_LABELS[step - 1];
}

/* ── Footer total ───────────────────────────────────────── */
function updateFooterTotal() {
  const t = calcTotal();
  document.getElementById('footerTotalAmount').textContent = formatMoney(t);
}

/* ── Step renderer ──────────────────────────────────────── */
function renderStep(step) {
  const body    = document.getElementById('modalBody');
  const backBtn = document.getElementById('backBtn');
  const nextBtn = document.getElementById('nextBtn');
  const header  = document.getElementById('modalHeader');
  const footer  = document.getElementById('modalFooter');

  header.style.display = '';
  footer.style.display = '';

  updateModalProgress(step);
  updateFooterTotal();

  backBtn.style.display = step > 1 ? '' : 'none';

  switch (step) {
    case 1: renderStep1(body); nextBtn.textContent = 'Continue →'; break;
    case 2: renderStep2(body); nextBtn.textContent = 'Continue →'; break;
    case 3: renderStep3(body); nextBtn.textContent = 'Continue →'; break;
    case 4: renderStep4(body); nextBtn.textContent = 'Continue →'; break;
    case 5: renderStep5(body); nextBtn.textContent = 'Continue →'; break;
    case 6: renderStep6(body); nextBtn.textContent = 'Continue →'; break;
    case 7: renderStep7(body); nextBtn.textContent = 'Confirm Booking'; break;
  }

  body.scrollTop = 0;
}

/* ── Step 1: Guest count ─────────────────────────────────── */
function renderStep1(body) {
  body.innerHTML = `
    <p class="step-sub">Adults ride solo. Children ride tandem with an adult in your group.</p>
    <div class="stepper-group">
      <div class="stepper-row">
        <div class="stepper-row__info">
          <p class="stepper-row__label">Adults</p>
          <p class="stepper-row__price">Rides solo, <strong>$${ADULT_PRICE} each</strong></p>
        </div>
        <div class="stepper">
          <button class="stepper__btn" id="adultMinus" onclick="changeCount('adults',-1)" aria-label="Remove adult">−</button>
          <span class="stepper__count" id="adultCount">${state.adults}</span>
          <button class="stepper__btn" onclick="changeCount('adults',1)" aria-label="Add adult">+</button>
        </div>
      </div>
      <div class="stepper-row">
        <div class="stepper-row__info">
          <p class="stepper-row__label">Children</p>
          <p class="stepper-row__price">Rides tandem with an adult, <strong>$${CHILD_PRICE} each</strong></p>
        </div>
        <div class="stepper">
          <button class="stepper__btn" id="childMinus" onclick="changeCount('children',-1)" aria-label="Remove child">−</button>
          <span class="stepper__count" id="childCount">${state.children}</span>
          <button class="stepper__btn" onclick="changeCount('children',1)" aria-label="Add child">+</button>
        </div>
      </div>
    </div>
    <div class="price-summary">
      <div class="price-summary__rows">
        <div class="price-summary__row" id="adultSummaryRow">
          <span><span id="adultSummaryCount">${state.adults}</span> adult${state.adults !== 1 ? 's' : ''}</span>
          <strong id="adultSummaryAmt">${formatMoney(state.adults * ADULT_PRICE)}</strong>
        </div>
        <div class="price-summary__row ${state.children === 0 ? 'is-hidden' : ''}" id="childSummaryRow">
          <span><span id="childSummaryCount">${state.children}</span> child${state.children !== 1 ? 'ren' : ''}</span>
          <strong id="childSummaryAmt">${formatMoney(state.children * CHILD_PRICE)}</strong>
        </div>
      </div>
      <div class="price-summary__total">
        <span class="price-summary__total-label">Total</span>
        <span class="price-summary__total-amount" id="priceSummaryTotal">${formatMoney(calcTotal())}</span>
      </div>
    </div>
  `;
  updateStepperButtons();
}

function changeCount(field, delta) {
  const newVal = state[field] + delta;
  if (newVal < 0) return;
  state[field] = newVal;
  // Update stepper display
  document.getElementById(field === 'adults' ? 'adultCount' : 'childCount').textContent = newVal;
  // Update summary
  const total = calcTotal();
  if (field === 'adults') {
    const row = document.getElementById('adultSummaryRow');
    const amt = document.getElementById('adultSummaryAmt');
    row.querySelector('span').innerHTML = '<span id="adultSummaryCount">' + newVal + '</span> adult' + (newVal !== 1 ? 's' : '');
    amt.textContent = formatMoney(newVal * ADULT_PRICE);
  } else {
    const row = document.getElementById('childSummaryRow');
    const amt = document.getElementById('childSummaryAmt');
    row.querySelector('span').innerHTML = '<span id="childSummaryCount">' + newVal + '</span> child' + (newVal !== 1 ? 'ren' : '');
    amt.textContent = formatMoney(newVal * CHILD_PRICE);
    row.classList.toggle('is-hidden', newVal === 0);
  }
  document.getElementById('priceSummaryTotal').textContent = formatMoney(total);
  updateFooterTotal();
  updateStepperButtons();
}

function updateStepperButtons() {
  const adultMinus = document.getElementById('adultMinus');
  const childMinus = document.getElementById('childMinus');
  if (adultMinus) adultMinus.disabled = state.adults <= 0;
  if (childMinus) childMinus.disabled = state.children <= 0;
}

/* ── Step 2: Date ────────────────────────────────────────── */
function renderStep2(body) {
  const today = todayInBahamas();
  body.innerHTML = `
    <p class="step-sub">We're open daily, 10am to 6pm. No timed slots. Arrive any time.</p>
    <input
      class="date-input"
      type="date"
      id="bookingDate"
      min="${today}"
      value="${state.date || ''}"
      onchange="state.date = this.value"
      aria-label="Select visit date"
    >
    <p class="date-hint">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Dates are set in Nassau, Bahamas time. No timezone confusion.
    </p>
  `;
}

/* ── Step 3: Lead guest details ──────────────────────────── */
function renderStep3(body) {
  body.innerHTML = `
    <p class="step-sub">We only need the lead guest's details, the person making the booking.</p>
    <div class="form-group">
      <label class="form-label" for="guestName">Full name <span>*</span></label>
      <input class="form-input" type="text" id="guestName" placeholder="Your full name"
        autocomplete="name" value="${escHtml(state.name)}"
        oninput="state.name = this.value; clearFieldErr('nameErr')">
      <p class="form-error" id="nameErr">Please enter your full name.</p>
    </div>
    <div class="form-group">
      <label class="form-label" for="guestEmail">Email address <span>*</span></label>
      <input class="form-input" type="email" id="guestEmail" placeholder="you@example.com"
        autocomplete="email" value="${escHtml(state.email)}"
        oninput="state.email = this.value; clearFieldErr('emailErr')">
      <p class="form-error" id="emailErr">Please enter a valid email address.</p>
    </div>
    <div class="form-group">
      <label class="form-label" for="guestPhone">Phone number <span>*</span></label>
      <input class="form-input" type="tel" id="guestPhone" placeholder="+1 (555) 000-0000"
        autocomplete="tel" value="${escHtml(state.phone)}"
        oninput="state.phone = this.value; clearFieldErr('phoneErr')">
      <p class="form-error" id="phoneErr">Please enter a valid phone number.</p>
    </div>
  `;
}

/* ── Step 4: Add-on interest ─────────────────────────────── */
const ADDON_LIST = [
  { id: 'mable',    label: 'Big Mable Tube Ride',               note: '$45/person · paid on-site',   tag: '$45' },
  { id: 'drone',    label: 'Drone Photos & Video',              note: '$45 · delivered same day',     tag: '$45' },
  { id: 'extra_js', label: 'Extra Jet Ski Time',                note: 'Priced on the day',            tag: 'Ask staff' },
  { id: 'lunch',    label: 'Lunch Package',                     note: 'At The Bay restaurant on-site',tag: 'On-site' },
  { id: 'transfer', label: 'Airport / Hotel Pickup or Drop-Off',note: 'Arranged via WhatsApp',        tag: 'WhatsApp' }
];

function renderStep4(body) {
  const checks = ADDON_LIST.map(a => `
    <label class="addon-check ${state.addons.includes(a.id) ? 'is-checked' : ''}" onclick="toggleAddon('${a.id}', this, event)">
      <input type="checkbox" ${state.addons.includes(a.id) ? 'checked' : ''} aria-label="${a.label}">
      <div class="addon-check__box">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="addon-check__info">
        <p class="addon-check__label">${a.label}</p>
        <p class="addon-check__note">${a.note}</p>
      </div>
      <span class="addon-check__tag">${a.tag}</span>
    </label>
  `).join('');

  body.innerHTML = `
    <p class="step-sub">Select anything you're interested in. All paid for and arranged on-site. Our team will follow up when you arrive.</p>
    <div class="addon-check-list">${checks}</div>
    <div class="form-group">
      <label class="form-label" for="bookingNotes">Anything else to mention?</label>
      <textarea class="notes-textarea" id="bookingNotes" placeholder="Special requests, accessibility needs, questions for the team…" oninput="state.notes = this.value">${escHtml(state.notes)}</textarea>
    </div>
  `;
}

function toggleAddon(id, labelEl, event) {
  if (event) event.preventDefault(); // stop label from double-firing the checkbox
  const idx = state.addons.indexOf(id);
  if (idx === -1) {
    state.addons.push(id);
    labelEl.classList.add('is-checked');
  } else {
    state.addons.splice(idx, 1);
    labelEl.classList.remove('is-checked');
  }
  labelEl.querySelector('input[type="checkbox"]').checked = idx === -1;
}

/* ── Step 5: Waiver ──────────────────────────────────────── */
function renderStep5(body) {
  body.innerHTML = `
    <p class="step-sub">Please read the terms below and confirm before continuing.</p>
    <div class="waiver-box">
      <p><strong>Liability Waiver &amp; Terms</strong></p>
      <br>
      <p>Water sports involve inherent risk. By proceeding, you acknowledge that all guests will participate at their own risk and agree to follow safety guidelines provided by our crew. Life jackets and safety briefings are provided for all guests. Summaz Escape reserves the right to cancel or postpone bookings due to adverse weather conditions with a full refund or reschedule.</p>
    </div>
    <label class="policy-check ${state.policyAccepted ? 'is-checked' : ''}" onclick="togglePolicy(this, event)">
      <input type="checkbox" id="policyCheckbox" ${state.policyAccepted ? 'checked' : ''} aria-label="Policy agreement">
      <div class="policy-check__box">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <p class="policy-check__text">
        I have read and accept the <a href="terms-and-conditions.html" target="_blank" rel="noopener" onclick="event.stopPropagation()">Terms &amp; Conditions</a>, <a href="refunds-and-cancellation.html" target="_blank" rel="noopener" onclick="event.stopPropagation()">Cancellation Policy</a>, and <a href="privacy-policy.html" target="_blank" rel="noopener" onclick="event.stopPropagation()">Privacy Policy</a>. I confirm all guests meet minimum age requirements.
      </p>
    </label>
    <p class="form-error is-visible" id="policyErr" style="display:none;margin-top:8px">You must accept the terms to continue.</p>
  `;
}

function togglePolicy(labelEl, event) {
  if (event) event.preventDefault(); // stop label from double-firing the checkbox
  state.policyAccepted = !state.policyAccepted;
  labelEl.classList.toggle('is-checked', state.policyAccepted);
  labelEl.querySelector('input[type="checkbox"]').checked = state.policyAccepted;
  const err = document.getElementById('policyErr');
  if (err) err.style.display = 'none';
}

/* ── Step 6: Payment method ──────────────────────────────── */
function renderStep6(body) {
  const methods = [
    {
      id: 'zelle', label: 'Zelle', tag: 'Send to anel@summazescape.com · or scan QR in your bank app',
      icon: '<img src="https://res.cloudinary.com/dko76z0df/image/upload/v1782304826/summaz/zelle-logo.png" class="payment-option__logo" alt="Zelle">'
    },
    {
      id: 'venmo', label: 'Venmo', tag: 'Pay via @summaz-escape · by username, link, or QR scan',
      icon: '<img src="https://res.cloudinary.com/dko76z0df/image/upload/v1782304825/summaz/venmo-logo.png" class="payment-option__logo" alt="Venmo">'
    },
    {
      id: 'arrival', label: 'Pay on Arrival', tag: 'Credit card machine on-site',
      icon: '<svg viewBox="0 0 24 16" width="34" height="23" fill="none" aria-hidden="true"><rect x=".5" y=".5" width="23" height="15" rx="2" fill="#0F172A" stroke="#334155"/><rect y="4" width="24" height="4" fill="#1E293B"/><rect x="2" y="10" width="6" height="4" rx="1" fill="#475569"/><circle cx="19.5" cy="12" r="2" fill="#EF4444" opacity=".75"/><circle cx="17" cy="12" r="2" fill="#F97316" opacity=".75"/></svg>'
    }
  ];

  const options = methods.map(m => `
    <label class="payment-option ${state.paymentMethod === m.id ? 'is-selected' : ''}" onclick="selectPayment('${m.id}', this)">
      <input type="radio" name="paymentMethod" value="${m.id}" ${state.paymentMethod === m.id ? 'checked' : ''}>
      <div class="payment-option__radio"><div class="payment-option__radio-dot"></div></div>
      <div class="payment-option__icon">${m.icon}</div>
      <div class="payment-option__info">
        <p class="payment-option__name">${m.label}</p>
        <span class="payment-option__tag">${m.tag}</span>
      </div>
    </label>
  `).join('');

  body.innerHTML = `
    <p class="step-sub">Zelle and Venmo are settled after booking. You'll receive full instructions and a QR code on the next screen and by email. Pay on Arrival means a card machine at the beach.</p>
    <div class="payment-options">${options}</div>
    <div class="payment-note is-arrival" id="arrivalNote">
      You'll pay by credit card machine when you arrive. Our team will call to confirm your booking shortly after you submit.
    </div>
    <p class="form-error" id="paymentErr" style="margin-top:8px">Please select a payment method.</p>
  `;
  if (state.paymentMethod === 'arrival') updatePaymentNotes('arrival');
}

function selectPayment(id, labelEl) {
  state.paymentMethod = id;
  document.querySelectorAll('.payment-option').forEach(el => el.classList.remove('is-selected'));
  labelEl.classList.add('is-selected');
  labelEl.querySelector('input[type="radio"]').checked = true;
  updatePaymentNotes(id);
  const err = document.getElementById('paymentErr');
  if (err) err.style.display = 'none';
}

function updatePaymentNotes(id) {
  ['zelleNote','venmoNote','arrivalNote'].forEach(n => {
    const el = document.getElementById(n);
    if (el) el.classList.remove('is-visible');
  });
  const map = { zelle: 'zelleNote', venmo: 'venmoNote', arrival: 'arrivalNote' };
  const target = document.getElementById(map[id]);
  if (target) target.classList.add('is-visible');
}

/* ── Step 7: Review ──────────────────────────────────────── */
function renderStep7(body) {
  const total = calcTotal();
  const addonLabels = state.addons.map(id => {
    const a = ADDON_LIST.find(x => x.id === id);
    return a ? a.label : id;
  });
  const paymentLabel = { zelle: 'Zelle', venmo: 'Venmo', arrival: 'Pay on Arrival' };
  const dateDisplay = state.date ? new Date(state.date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : 'Not set';

  body.innerHTML = `
    <p class="step-sub">Everything look right? Hit Confirm Booking when you're ready.</p>
    <div class="submit-error" id="submitError"></div>
    <div class="review-card">
      <div class="review-card__head">Booking Details</div>
      <div class="review-card__rows">
        <div class="review-row">
          <span class="review-row__label">Date</span>
          <span class="review-row__value">${dateDisplay}</span>
        </div>
        <div class="review-row">
          <span class="review-row__label">Adults</span>
          <span class="review-row__value">${state.adults} × $${ADULT_PRICE} = ${formatMoney(state.adults * ADULT_PRICE)}</span>
        </div>
        ${state.children > 0 ? `<div class="review-row">
          <span class="review-row__label">Children</span>
          <span class="review-row__value">${state.children} × $${CHILD_PRICE} = ${formatMoney(state.children * CHILD_PRICE)}</span>
        </div>` : ''}
        ${addonLabels.length > 0 ? `<div class="review-row">
          <span class="review-row__label">Extras interest</span>
          <span class="review-row__value">${addonLabels.join(', ')}</span>
        </div>` : ''}
      </div>
      <div class="review-total">
        <span class="review-total__label">Total due</span>
        <span class="review-total__amount">${formatMoney(total)}</span>
      </div>
    </div>
    <div class="review-card">
      <div class="review-card__head">Your Details</div>
      <div class="review-card__rows">
        <div class="review-row">
          <span class="review-row__label">Name</span>
          <span class="review-row__value">${escHtml(state.name)}</span>
        </div>
        <div class="review-row">
          <span class="review-row__label">Email</span>
          <span class="review-row__value">${escHtml(state.email)}</span>
        </div>
        <div class="review-row">
          <span class="review-row__label">Phone</span>
          <span class="review-row__value">${escHtml(state.phone)}</span>
        </div>
        <div class="review-row">
          <span class="review-row__label">Payment</span>
          <span class="review-row__value">${paymentLabel[state.paymentMethod] || 'Not selected'}</span>
        </div>
      </div>
    </div>
  `;
}

/* ── Validation helpers ──────────────────────────────────── */
function showFieldErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-visible');
  el.style.display = 'block';
}

function clearFieldErr(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('is-visible');
  el.style.display = 'none';
}

/* ── Validation ─────────────────────────────────────────── */
async function validateStep(step) {
  switch (step) {
    case 1:
      if (state.adults + state.children < 1) {
        alert('Please add at least one guest.');
        return false;
      }
      return true;

    case 2:
      if (!state.date) {
        alert('Please select a date for your visit.');
        document.getElementById('bookingDate')?.focus();
        return false;
      }
      if (state.date < todayInBahamas()) {
        alert('Please select today or a future date.');
        return false;
      }
      return true;

    case 3: {
      ['nameErr','emailErr','phoneErr'].forEach(id => clearFieldErr(id));
      let valid = true;

      /* Name: letters, spaces, hyphens, apostrophes only, min 2 chars */
      const nameTrimmed = state.name.trim();
      if (nameTrimmed.length < 2) {
        showFieldErr('nameErr', 'Please enter your full name.');
        valid = false;
      } else if (!/^[a-zA-ZÀ-ÿ\s'\-]+$/.test(nameTrimmed)) {
        showFieldErr('nameErr', 'Name should contain letters only, no numbers.');
        valid = false;
      }

      /* Email: format */
      const emailTrimmed = state.email.trim().toLowerCase();
      const emailRe = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
      if (!emailRe.test(emailTrimmed)) {
        showFieldErr('emailErr', 'Please enter a valid email address.');
        valid = false;
      }

      /* Phone: min 7 digits, not all-same */
      const digits = state.phone.replace(/\D/g, '');
      if (digits.length < 7) {
        showFieldErr('phoneErr', 'Please enter a valid phone number (at least 7 digits).');
        valid = false;
      } else if (/^(\d)\1+$/.test(digits)) {
        showFieldErr('phoneErr', 'Please enter a valid phone number.');
        valid = false;
      }

      if (!valid) return false;

      /* Disposable email check — fail open on API error */
      const domain = emailTrimmed.split('@')[1];
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Checking…'; }
        const r = await fetch(`https://api.mailcheck.ai/domain/${encodeURIComponent(domain)}`, { signal: ctrl.signal });
        clearTimeout(t);
        if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Continue →'; }
        if (r.ok) {
          const data = await r.json();
          if (data.disposable) {
            showFieldErr('emailErr', 'Please use a permanent email address.');
            return false;
          }
        }
      } catch (_) {
        /* timed out or network error — let user through */
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Continue →'; }
      }

      return true;
    }

    case 4: return true;

    case 5:
      if (!state.policyAccepted) {
        const err = document.getElementById('policyErr');
        if (err) err.style.display = 'block';
        return false;
      }
      return true;

    case 6:
      if (!state.paymentMethod) {
        const err = document.getElementById('paymentErr');
        if (err) err.style.display = 'block';
        return false;
      }
      return true;

    default: return true;
  }
}

/* ── Navigation ─────────────────────────────────────────── */
async function nextStep() {
  if (state.honeypot) return;

  if (!await validateStep(state.currentStep)) return;

  if (state.currentStep === 7) {
    submitBooking();
    return;
  }

  state.currentStep++;
  renderStep(state.currentStep);
}

function prevStep() {
  if (state.currentStep <= 1) return;
  state.currentStep--;
  renderStep(state.currentStep);
}

/* ── Form submission ─────────────────────────────────────── */
function submitBooking() {
  // One more honeypot check
  if (state.honeypot) return;

  const loading = document.getElementById('loadingOverlay');
  loading.classList.add('is-visible');

  const payload = {
    adults:        state.adults,
    children:      state.children,
    date:          state.date,
    name:          state.name.trim(),
    email:         state.email.trim().toLowerCase(),
    phone:         state.phone.trim(),
    addons:        state.addons.map(id => { const a = ADDON_LIST.find(x => x.id === id); return a ? a.label : id; }).join(', '),
    notes:         state.notes.trim(),
    policyAccepted: true,
    paymentMethod: state.paymentMethod,
    total:         calcTotal(),
    honeypot:      state.honeypot,
    elapsed:       Date.now() - _formOpenedAt
  };

  const scriptUrl = window.SUMMAZ_CONFIG?.scriptUrl;

  if (!scriptUrl || scriptUrl === 'YOUR_APPS_SCRIPT_WEB_APP_URL') {
    // Dev mode: simulate a successful response
    setTimeout(() => {
      loading.classList.remove('is-visible');
      showConfirmation({
        reference: 'SE-' + Math.floor(100000 + Math.random() * 900000),
        total: payload.total
      });
    }, 1200);
    return;
  }

  fetch(scriptUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  })
  .then(r => r.json())
  .then(data => {
    loading.classList.remove('is-visible');
    if (data.success) {
      showConfirmation(data);
    } else {
      showSubmitError((data.error || 'Something went wrong.') + ' Please try again or contact us via WhatsApp.');
    }
  })
  .catch(err => {
    loading.classList.remove('is-visible');
    console.error('Booking fetch error:', err);
    showSubmitError('Could not reach our booking server. Please try again, or WhatsApp us directly to book.');
  });
}

function showSubmitError(msg) {
  const err = document.getElementById('submitError');
  if (err) {
    err.textContent = msg;
    err.classList.add('is-visible');
    err.style.display = 'block';
    err.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/* ── Confirmation screen ─────────────────────────────────── */
function showConfirmation(data) {
  state.reference = data.reference;
  state.total     = data.total || calcTotal();

  const cfg    = window.SUMMAZ_CONFIG || {};
  const method = state.paymentMethod;
  const ref    = data.reference;
  const total  = formatMoney(state.total);

  const dateDisplay = state.date
    ? new Date(state.date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
    : '';

  let instructions = '';
  if (method === 'zelle') {
    instructions = `
      <div class="confirmation__instructions">
        <p>Open Zelle and send <strong>${total}</strong> to <strong>${escHtml(cfg.zelle)}</strong> — or scan the QR code below in your bank's app to send the payment directly into our Zelle:</p>
        <img src="${escHtml(cfg.zelleQr)}" alt="Zelle QR code" class="confirmation__qr">
        <p style="margin-top:16px;font-weight:600;">Then send us your payment screenshot:</p>
        <ol>
          <li>Reply to your confirmation email with your screenshot attached. In the message body write: <strong>Payment for ${escHtml(ref)}</strong></li>
          <li>Or send a new email to <strong><a href="mailto:${cfg.bookingEmail}">${cfg.bookingEmail}</a></strong> with subject <strong>Payment for ${escHtml(ref)}</strong> and your screenshot attached.</li>
        </ol>
        <p style="margin-top:10px;font-size:13px;color:var(--text-muted);">Your reservation holds for 24 hours. Once we receive your screenshot, we'll confirm your booking.</p>
      </div>
    `;
  } else if (method === 'venmo') {
    instructions = `
      <div class="confirmation__instructions">
        <p>Send <strong>${total}</strong> to <strong>${escHtml(cfg.venmo)}</strong> on Venmo — or <a href="${cfg.venmoUrl}" target="_blank" rel="noopener" style="color:#0077B6;">click here to open Venmo</a> — or scan the QR code below to pay directly:</p>
        <img src="${escHtml(cfg.venmoQr)}" alt="Venmo QR code" class="confirmation__qr">
        <p style="margin-top:16px;font-weight:600;">Then send us your payment screenshot:</p>
        <ol>
          <li>Reply to your confirmation email with your screenshot attached. In the message body write: <strong>Payment for ${escHtml(ref)}</strong></li>
          <li>Or send a new email to <strong><a href="mailto:${cfg.bookingEmail}">${cfg.bookingEmail}</a></strong> with subject <strong>Payment for ${escHtml(ref)}</strong> and your screenshot attached.</li>
        </ol>
        <p style="margin-top:10px;font-size:13px;color:var(--text-muted);">Your reservation holds for 24 hours. Once we receive your screenshot, we'll confirm your booking.</p>
      </div>
    `;
  } else {
    instructions = `
      <div class="confirmation__instructions">
        <p>Your spot is reserved. No payment needed until you arrive. Bring your card on the day.</p>
        <p style="margin-top:12px;font-weight:600;">To confirm your place:</p>
        <ol>
          <li>Reply to your confirmation email with <strong>Confirmed ${escHtml(ref)}</strong> in the message body.</li>
          <li>Or email <strong><a href="mailto:${cfg.bookingEmail}">${cfg.bookingEmail}</a></strong> with subject <strong>Confirmed ${escHtml(ref)}</strong>.</li>
        </ol>
      </div>
    `;
  }

  const addonLabels = state.addons.map(id => {
    const a = ADDON_LIST.find(x => x.id === id);
    return a ? a.label : id;
  });

  // Hide header/footer, show confirmation in body
  document.getElementById('modalHeader').style.display = 'none';
  document.getElementById('modalFooter').style.display = 'none';
  document.getElementById('modalProgressFill').style.width = '100%';

  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <div class="confirmation">
      <div class="confirmation__check">
        <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h2 class="confirmation__title">You're booked.</h2>
      <p class="confirmation__sub">Save your booking reference. You will need it when you arrive.</p>
      <p class="confirmation__email-notice">We sent a confirmation to <strong>${escHtml(state.email)}</strong></p>
      <div class="reference-box">
        <div class="reference-box__label">Booking Reference</div>
        <div class="reference-box__code" id="refCode">${ref}</div>
        <button class="copy-btn" onclick="copyReference('${ref}', this)" aria-label="Copy reference number">Copy reference</button>
      </div>
      ${instructions}
      <div class="confirmation__meta">
        <div class="confirmation__meta-item">
          <div class="confirmation__meta-label">Date</div>
          <div class="confirmation__meta-value">${dateDisplay}</div>
        </div>
        <div class="confirmation__meta-item">
          <div class="confirmation__meta-label">Guests</div>
          <div class="confirmation__meta-value">${state.adults} adult${state.adults !== 1 ? 's' : ''}${state.children > 0 ? ` · ${state.children} child${state.children !== 1 ? 'ren' : ''}` : ''}</div>
        </div>
        <div class="confirmation__meta-item">
          <div class="confirmation__meta-label">Total</div>
          <div class="confirmation__meta-value">${total}</div>
        </div>
        <div class="confirmation__meta-item">
          <div class="confirmation__meta-label">Payment</div>
          <div class="confirmation__meta-value">${{ zelle: 'Zelle', venmo: 'Venmo', arrival: 'On Arrival' }[method] || 'Not set'}</div>
        </div>
      </div>
      <button class="btn btn--outline btn--full confirmation__close-btn" onclick="closeBooking()">Close</button>
    </div>
  `;
}

function copyReference(ref, btn) {
  navigator.clipboard.writeText(ref).then(() => {
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.textContent = 'Copy reference'; }, 2500);
  }).catch(() => {
    const range = document.createRange();
    const el = document.getElementById('refCode');
    if (el) {
      range.selectNode(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand('copy');
      window.getSelection().removeAllRanges();
      btn.textContent = '✓ Copied';
      setTimeout(() => { btn.textContent = 'Copy reference'; }, 2500);
    }
  });
}

/* ── Helpers ────────────────────────────────────────────── */
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Hero background crossfade ──────────────────────────── */
(function() {
  const slides = [1,2,3,4].map(function(n) {
    return document.querySelector('.hero__slide--' + n);
  }).filter(Boolean);
  if (slides.length < 2) return;
  let current = 0;
  setInterval(function() {
    slides[current].style.opacity = '0';
    current = (current + 1) % slides.length;
    slides[current].style.opacity = '1';
  }, 5000);
})();

/* ── Mobile bar: hide during hero, fade in once scrolled past */
(function() {
  const hero = document.querySelector('.hero');
  const bar  = document.querySelector('.mobile-bar');
  if (!hero || !bar) return;
  const obs = new IntersectionObserver(entries => {
    bar.classList.toggle('is-visible', !entries[0].isIntersecting);
  }, { threshold: 0 });
  obs.observe(hero);
})();

/* ── Testimonials column — duplicate for seamless loop ───── */
(function() {
  document.querySelectorAll('.tcol-inner').forEach(col => {
    col.innerHTML += col.innerHTML;
  });
})();

/* ── Behold Instagram feed ───────────────────────────────── */
const BEHOLD_FEED_URL  = 'https://feeds.behold.so/2SE3Lr6MzDuMSlLkdgxr';
const BEHOLD_CACHE_KEY = 'summaze_behold_feed';
const BEHOLD_CACHE_MS  = 60 * 60 * 1000; // 1 hour

async function getFeedData() {
  try {
    const raw = localStorage.getItem(BEHOLD_CACHE_KEY);
    if (raw) {
      const { timestamp, data } = JSON.parse(raw);
      if (Date.now() - timestamp < BEHOLD_CACHE_MS) return data;
    }
  } catch (e) {}

  const res  = await fetch(BEHOLD_FEED_URL);
  const data = await res.json();

  try {
    localStorage.setItem(BEHOLD_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch (e) {}

  return data;
}

function renderReels(posts) {
  const track   = document.getElementById('beholdReelsTrack');
  const section = document.getElementById('reels');
  if (!track) return;

  const reels = posts.filter(p => p.mediaType === 'VIDEO' && p.isReel === true);
  if (reels.length === 0) { if (section) section.style.display = 'none'; return; }

  track.innerHTML = reels.map(reel => {
    const thumb   = reel.thumbnailUrl || (reel.sizes && reel.sizes.medium && reel.sizes.medium.mediaUrl) || '';
    const caption = reel.prunedCaption ? reel.prunedCaption.trim() : '';
    const short   = caption.length > 72 ? caption.slice(0, 72) + '…' : caption;
    return `<a href="${escHtml(reel.permalink)}" target="_blank" rel="noopener" class="reel-card">
      <div class="reel-card__thumb">
        ${thumb ? `<img src="${escHtml(thumb)}" alt="Summaz Escape reel" loading="lazy">` : ''}
        <div class="reel-card__play"><svg viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
      </div>
      ${short ? `<p class="reel-card__caption">${escHtml(short)}</p>` : ''}
    </a>`;
  }).join('');

  // Start the auto-slide after a tick so layout is calculated
  requestAnimationFrame(() => startReelsSlider(track));
}

function startReelsSlider(strip) {
  if (strip.children.length === 0) return;

  // Clone all cards for seamless infinite loop
  [...strip.children].forEach(card => strip.appendChild(card.cloneNode(true)));

  const wrap   = strip.parentElement;
  let pos      = 0;
  let paused   = false;
  const speed  = 0.55; // px per animation frame (~33px/sec at 60fps)

  wrap.addEventListener('mouseenter', () => { paused = true; });
  wrap.addEventListener('mouseleave', () => { paused = false; });
  wrap.addEventListener('touchstart', () => { paused = true; }, { passive: true });
  wrap.addEventListener('touchend',   () => { setTimeout(() => { paused = false; }, 1800); });

  function tick() {
    if (!paused) {
      pos += speed;
      const half = strip.scrollWidth / 2;
      if (pos >= half) pos = 0;
      strip.style.transform = `translateX(-${pos}px)`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function renderGallery(posts) {
  const grid    = document.getElementById('beholdGalleryGrid');
  const section = document.getElementById('gallery');
  if (!grid) return;

  const items = [];
  for (const post of posts) {
    if (post.isReel) continue;
    if (post.mediaType === 'VIDEO') continue;
    if (post.mediaType === 'IMAGE') {
      const url = post.sizes && post.sizes.medium && post.sizes.medium.mediaUrl;
      if (url) items.push({ url, permalink: post.permalink, w: post.sizes.medium.width, h: post.sizes.medium.height });
    } else if (post.mediaType === 'CAROUSEL_ALBUM' && post.children) {
      for (const child of post.children) {
        if (child.mediaType === 'IMAGE') {
          const url = child.sizes && child.sizes.medium && child.sizes.medium.mediaUrl;
          if (url) items.push({ url, permalink: post.permalink, w: child.sizes.medium.width, h: child.sizes.medium.height });
        }
      }
    }
  }

  if (items.length === 0) { if (section) section.style.display = 'none'; return; }

  grid.innerHTML = items.map(it => `
    <a href="${escHtml(it.permalink)}" target="_blank" rel="noopener" class="behold-photo">
      <img src="${escHtml(it.url)}" alt="Summaz Escape" loading="lazy" width="${it.w}" height="${it.h}">
      <div class="behold-photo__overlay">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/></svg>
      </div>
    </a>`).join('');
}

(async function initBehold() {
  try {
    const data = await getFeedData();
    if (data && Array.isArray(data.posts)) {
      renderReels(data.posts);
      renderGallery(data.posts);
    }
  } catch (e) {
    console.error('Behold feed failed:', e);
    const rs = document.getElementById('reels');
    const gs = document.getElementById('gallery');
    if (rs) rs.style.display = 'none';
    if (gs) gs.style.display = 'none';
  }
})();

/* ── Video lightbox ──────────────────────────────────────── */
(function() {
  const lb      = document.getElementById('vlightbox');
  const wrap    = document.getElementById('vlightboxWrap');
  const closeBtn= document.getElementById('vlightboxClose');
  if (!lb || !wrap || !closeBtn) return;

  function openVideo(src) {
    const v = document.createElement('video');
    v.src        = src;
    v.controls   = true;
    v.autoplay   = true;
    v.playsInline= true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    wrap.appendChild(v);
    lb.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    v.play().catch(function() {});
  }

  function closeVideo() {
    const v = wrap.querySelector('video');
    if (v) { v.pause(); v.src = ''; wrap.removeChild(v); }
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closeVideo);
  lb.addEventListener('click', function(e) { if (e.target === lb) closeVideo(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && lb.classList.contains('is-open')) closeVideo(); });

  document.querySelectorAll('.vcard').forEach(function(card) {
    card.addEventListener('click', function() { openVideo(card.dataset.src); });
    card.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openVideo(card.dataset.src); } });
  });
})();

/* ── Pricing card counters ───────────────────────────────── */
var _ticketAdult = 0;
var _ticketChild = 0;

function ticketCount(type, delta) {
  if (type === 'adult') {
    _ticketAdult = Math.max(0, _ticketAdult + delta);
    document.getElementById('ticketAdultCount').textContent = _ticketAdult;
    document.getElementById('ticketAdultMinus').disabled = _ticketAdult <= 0;
  } else {
    _ticketChild = Math.max(0, _ticketChild + delta);
    document.getElementById('ticketChildCount').textContent = _ticketChild;
    document.getElementById('ticketChildMinus').disabled = _ticketChild <= 0;
  }
}

function addToSidebar(field) {
  var count = field === 'adults' ? _ticketAdult : _ticketChild;
  if (count === 0) return;
  sidebarCount(field, count);
  if (field === 'adults') {
    _ticketAdult = 0;
    document.getElementById('ticketAdultCount').textContent = 0;
    document.getElementById('ticketAdultMinus').disabled = true;
  } else {
    _ticketChild = 0;
    document.getElementById('ticketChildCount').textContent = 0;
    document.getElementById('ticketChildMinus').disabled = true;
  }
}

