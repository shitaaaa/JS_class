/* 露營訂位系統：Day.js + db.json（示範用，無真實後端） */
(() => {
  'use strict';
  const fmt = 'YYYY-MM-DD';
  const areaNames = { aArea: '河畔 × A區', bArea: '山間 × B區', cArea: '平原 × C區', dArea: '車屋 × D區' };
  const root = document.querySelector('#lokiReserve');
  if (!root || typeof dayjs !== 'function') return;

  const leftList = root.querySelector('.leftDayList');
  const rightList = root.querySelector('.rightDayList');
  const leftTitle = root.querySelector('.leftBar h4');
  const rightTitle = root.querySelector('.rightBar h4');
  const bookingForm = root.querySelector('#selectPallet');
  const summary = bookingForm.querySelector('h3');
  const selects = [...bookingForm.querySelectorAll('select[name]')];
  const reserveButton = bookingForm.querySelector('button[type="button"]');
  const panel = document.querySelector('#bookingPanel');
  const orderForm = document.querySelector('#orderForm');
  const offcanvas = new bootstrap.Offcanvas(panel);
  const money = n => '$' + Number(n).toLocaleString('zh-TW');

  let shownMonth = dayjs().startOf('month');
  let holidays = new Set();
  let booked = [];
  let pallet = {};
  let checkIn = null;
  let checkOut = null;
  let quantities = {};
  let details = {};
  let total = 0;
  let normalNights = 0;
  let holidayNights = 0;

  function isHoliday(date) {
    return date.day() === 0 || date.day() === 6 || holidays.has(date.format(fmt));
  }
  function soldFor(date, key) {
    const record = booked.find(row => row.date === date.format(fmt));
    return Number(record?.sellout?.[key] || 0);
  }
  function isFull(date) {
    return Object.keys(pallet).every(key => soldFor(date, key) >= pallet[key].total);
  }
  function nights() {
    const result = [];
    if (!checkIn || !checkOut) return result;
    for (let d = checkIn; d.isBefore(checkOut, 'day'); d = d.add(1, 'day')) result.push(d);
    return result;
  }
  function drawMonth(month, list, title) {
    title.textContent = month.format('MMMM YYYY');
    const firstWeekday = (month.startOf('month').day() + 6) % 7;
    const fragments = [];
    for (let i = 0; i < firstWeekday; i++) fragments.push('<li class="JsCal" aria-hidden="true"></li>');
    for (let i = 1; i <= month.daysInMonth(); i++) {
      const date = month.date(i);
      const key = date.format(fmt);
      const past = !date.isAfter(dayjs(), 'day');
      const full = isFull(date);
      const classes = ['JsCal'];
      if (isHoliday(date)) classes.push('holiday');
      if (past) classes.push('delDay');
      else if (full) classes.push('fullDay');
      else classes.push('selectDay');
      if (checkIn && key === checkIn.format(fmt)) classes.push('selectHead');
      if (checkOut && key === checkOut.format(fmt)) classes.push('selectFoot');
      if (checkIn && checkOut && date.isAfter(checkIn, 'day') && date.isBefore(checkOut, 'day')) classes.push('selectConnect');
      fragments.push(`<li class="${classes.join(' ')}" data-date="${key}" ${past || full ? 'aria-disabled="true"' : 'tabindex="0" role="button"'} aria-label="${key}">${i}</li>`);
    }
    list.innerHTML = fragments.join('');
  }
  function drawCalendar() {
    drawMonth(shownMonth, leftList, leftTitle);
    drawMonth(shownMonth.add(1, 'month'), rightList, rightTitle);
  }
  function resetSelection() {
    checkIn = null;
    checkOut = null;
    quantities = {};
    drawCalendar();
    updateTable();
  }
  function chooseDate(date) {
    if (!date.isAfter(dayjs(), 'day') || isFull(date)) return;
    if (!checkIn || checkOut) {
      checkIn = date;
      checkOut = null;
    } else if (!date.isAfter(checkIn, 'day')) {
      checkIn = date;
    } else {
      // A booking range cannot contain a fully booked night.
      for (let d = checkIn; d.isBefore(date, 'day'); d = d.add(1, 'day')) {
        if (isFull(d)) {
          alert('所選日期包含已滿帳的夜晚，請重新選擇');
          return;
        }
      }
      checkOut = date;
    }
    quantities = {};
    drawCalendar();
    updateTable();
  }
  function updateTotal() {
    total = 0;
    selects.forEach(select => {
      const key = select.name;
      quantities[key] = Number(select.value || 0);
      total += quantities[key] * (details[key]?.price || 0);
    });
    summary.textContent = `${money(total)} / ${normalNights}晚平日，${holidayNights}晚假日`;
  }
  function updateTable() {
    const selectedNights = nights();
    normalNights = selectedNights.filter(date => !isHoliday(date)).length;
    holidayNights = selectedNights.length - normalNights;
    details = {};
    selects.forEach(select => {
      const key = select.name;
      const config = pallet[key];
      if (!config) return;
      const row = select.closest('tr');
      const stock = selectedNights.length
        ? Math.max(0, Math.min(...selectedNights.map(date => config.total - soldFor(date, key))))
        : 0;
      const dailyPrices = selectedNights.map(date => ({
        date: date.format(fmt),
        price: Number(config[isHoliday(date) ? 'holidayPrice' : 'normalPrice'])
      }));
      details[key] = { stock, dailyPrices, price: dailyPrices.reduce((sum, item) => sum + item.price, 0) };
      const previous = Math.min(quantities[key] || 0, stock);
      select.innerHTML = Array.from({ length: stock + 1 }, (_, n) => `<option value="${n}">${n}</option>`).join('');
      select.value = String(previous);
      select.disabled = stock === 0;
      row.querySelector('td[name="pallet"] label span').textContent = stock;
      row.querySelector('td[name="pallet"] + td').innerHTML = dailyPrices.length && stock
        ? dailyPrices.map(item => `<div>${item.date} (${money(item.price)})</div>`).join('')
        : '<div class="text-muted">請先選擇入住與退房日期</div>';
    });
    updateTotal();
    reserveButton.disabled = !checkOut || total <= 0;
  }
  function openConfirmation() {
    if (!checkOut || total <= 0) return;
    const chosen = selects.filter(s => Number(s.value) > 0);
    panel.querySelector('ol').innerHTML = chosen.map(select => {
      const key = select.name;
      return `<li class="list-group-item d-flex justify-content-between align-items-start">
        <div class="ms-2 me-auto"><div class="fw-bold">${areaNames[key]}</div>
        ${details[key].dailyPrices.map(item => `<div>${item.date} (${money(item.price)})</div>`).join('')}</div>
        <span class="badge bg-warning text-dark rounded-pill">× ${select.value} 帳</span></li>`;
    }).join('');
    panel.querySelector('.card-header').textContent = `${money(total)} / ${normalNights}晚平日，${holidayNights}晚假日`;
    panel.querySelector('#bookingDates').textContent = `入住：${checkIn.format(fmt)}　退房：${checkOut.format(fmt)}`;
    offcanvas.show();
  }

  root.querySelector('a[href="#prevCtrl"]').addEventListener('click', event => {
    event.preventDefault();
    const previous = shownMonth.subtract(1, 'month');
    if (previous.isBefore(dayjs().startOf('month'), 'month')) return;
    shownMonth = previous;
    drawCalendar();
  });
  root.querySelector('a[href="#nextCtrl"]').addEventListener('click', event => {
    event.preventDefault();
    shownMonth = shownMonth.add(1, 'month');
    drawCalendar();
  });
  [leftList, rightList].forEach(list => {
    const activate = event => {
      const node = event.target.closest('li[data-date]');
      if (!node || node.classList.contains('delDay') || node.classList.contains('fullDay')) return;
      chooseDate(dayjs(node.dataset.date));
    };
    list.addEventListener('click', activate);
    list.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate(event);
      }
    });
  });
  selects.forEach(select => select.addEventListener('change', updateTotal));
  reserveButton.addEventListener('click', openConfirmation);
  orderForm.addEventListener('submit', event => {
    event.preventDefault();
    orderForm.classList.add('was-validated');
    if (!orderForm.checkValidity() || !checkOut || total <= 0) return;
    const payload = {
      userName: orderForm.elements.userName.value.trim(),
      userPhone: orderForm.elements.userPhone.value.trim(),
      userMail: orderForm.elements.userMail.value.trim(),
      selectDate: nights().map(date => date.format(fmt)),
      sellout: Object.fromEntries(selects.map(select => [select.name, Number(select.value)])),
      totalPrice: total
    };
    // db.json 是靜態資料，沒有可儲存訂單的後端。僅供練習檢查 payload。
    console.log('示範訂單（未送至伺服器）:', payload);
    alert('示範訂單資料已建立（請查看 Console）。目前尚未連接正式訂位後端，並未實際完成預約。');
    offcanvas.hide();
  });

  fetch('db.json')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(json => {
      holidays = new Set(json.nationalHoliday || []);
      booked = json.booked || [];
      pallet = json.pallet || {};
      drawCalendar();
      updateTable();
    })
    .catch(error => {
      console.error('載入訂位資料失敗：', error);
      summary.textContent = '訂位資料讀取失敗，請使用 Live Server 開啟網站';
      reserveButton.disabled = true;
    });
})();
