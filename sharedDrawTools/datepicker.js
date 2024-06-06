// vanilla js datepicker
// https://codepen.io/tomuzarowski/pen/xxZOEGV

class Calendar {
    constructor(inputSelector) {
        this.input = document.querySelector(inputSelector);
        this.form = this.input.parentElement;
        this.popupContainer = null;
        this.monthContainer = null;
        this.tableContainer = null;
        this.table = document.createElement("table");
        this.table.style['font-size'] = '12px'
        this.table.style.width = '200px'
        this.table.style.cursor = 'pointer'
        this.shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        this.months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        this.selectedMonth = new Date().getMonth();
        this.selectedYear = new Date().getFullYear();
        
        this.buildCalendar();
        this.setMainEventListener();
    }
    
    buildCalendar() {
        this.popupContainer = document.createElement("div");
        this.popupContainer.classList.add("calendar-popup");
        this.popupContainer.style.display = 'none'
        this.form.appendChild(this.popupContainer);

        this.createButtonLeft();
        
        this.monthContainer = document.createElement("span");
        this.monthContainer.classList.add("month-and-year");
        this.monthContainer.innerHTML = `<b>${this.getMonth()} ${this.getYear()}</b>`;
        this.popupContainer.appendChild(this.monthContainer);

        this.createButtonRight();


        this.populateTable(this.selectedMonth, this.selectedYear);
    }

    createButtonLeft() {
        const prev = document.createElement("button");
        prev.classList.add('button', 'prev');
        prev.style.cursor = 'pointer'
        prev.innerHTML = '<b><</b>' // "<i class='fas fa-chevron-left'></i>";

        prev.addEventListener("click", e => {
            e.preventDefault();
            this.updateMonth(this.selectedMonth - 1);
        });
        this.popupContainer.appendChild(prev);
    }
    createButtonRight() {
        const next = document.createElement("button");
        next.classList.add('button', 'next');
        next.style.cursor = 'pointer'
        next.innerHTML = '<b>></b>' // "<i class='fas fa-chevron-right'></i>";

        next.addEventListener("click", e => {
            e.preventDefault();
            this.updateMonth(this.selectedMonth + 1);
        });

        this.popupContainer.appendChild(next);
    }

    populateTable(month, year) {
        this.table.innerHTML = "";

        const namesRow = document.createElement("tr");
        ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(name => {
            const th = document.createElement("th");
            th.innerHTML = name;
            namesRow.appendChild(th);
        });
        this.table.appendChild(namesRow);

        const tempDate = new Date(year, month, 1);
        let firstMonthDay = tempDate.getDay();
        firstMonthDay = firstMonthDay === 0 ? 7 : tempDate.getDay();

        const daysInMonth = this.getDaysInMonth(month, year);
        const j = daysInMonth + firstMonthDay - 1;

        let tr = document.createElement("tr");

        if (firstMonthDay-1 !== 0) {
            tr = document.createElement("tr");
            this.table.appendChild(tr);
        }

        for (let i=0; i<firstMonthDay-1; i++) {
            const td = document.createElement("td");
            td.innerHTML = "";
            tr.appendChild(td);
        }

        for (let i = firstMonthDay-1; i<j; i++) {
            if(i % 7 === 0){
                tr = document.createElement("tr");
                this.table.appendChild(tr);
            }

            const td = document.createElement("td");
            td.innerText = i - firstMonthDay + 2;
            td.dayNr = i - firstMonthDay + 2;
            td.style['text-align'] = 'center'
            td.classList.add("day");

            td.addEventListener("click", e => {
                const selectedDay = e.target.innerHTML;
                this.fillInput(selectedDay);
                this.hideCalendar();
                if (this.onChooseDate) this.onChooseDate(e)
            });

            tr.appendChild(td);
        }

        this.popupContainer.appendChild(this.table);
    }

    fillInput(day) {
        day = day < 10 ? "0" + day : day;
        let month = null;
        month = this.shortMonths[this.selectedMonth] // this.selectedMonth < 9 ? "0" + (this.selectedMonth + 1) : this.selectedMonth + 1;
        this.input.value = `${day} ${month} ${this.selectedYear}`;
    }

    updateMonth(month) {
        this.selectedMonth = month;
        if (this.selectedMonth < 0) {
            this.selectedYear--;
            this.selectedMonth = 11;
        } else if (this.selectedMonth > 11) {
            this.selectedYear++;
            this.selectedMonth = 0;
        }
        this.monthContainer.innerHTML = `<b>${this.months[this.selectedMonth]} ${this.selectedYear}</b>`;

        this.populateTable(this.selectedMonth, this.selectedYear)
    }
    
    getMonth() {
        return this.months[this.selectedMonth];
    }

    getYear() {
        return this.selectedYear;
    }

    getDaysInMonth(month, year) {
        return new Date(year, month + 1, 0).getDate();
    }
    
    hideCalendar() {
        this.form.classList.remove("open");
        this.popupContainer.style.display = 'none'
    }

    setMainEventListener() {
        this.input.addEventListener("click", e => {
            this.form.classList.toggle("open");
            this.input.nextElementSibling.style.display = 'block' //classList.toggle("open");
            
            if(!this.form.classList.contains("open")) {
                this.hideCalendar();
            } else {
                const date = new Date(this.input.value)
                if (!isNaN(date.getTime())) {
                    this.selectedMonth = date.getMonth() + 1
                    this.selectedYear = date.getFullYear()
                    this.updateMonth(this.selectedMonth - 1)
                    // this.populateTable(this.selectedMonth, this.selectedYear)
                }
            }
        });
    }
}
// setTimeout(function () {
//     new Calendar("#dateInput");
// }, 1000)
