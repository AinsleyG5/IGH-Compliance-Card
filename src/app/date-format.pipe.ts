import { Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';

@Pipe({
  name: 'dateFormat'
})
export class DateFormatPipe extends DatePipe implements PipeTransform {
  transform(value: any, amount?: any, type?: any): any {
    let year = value.getFullYear();
    let month = value.getMonth();
    let day = value.getDate();
    let newDate: Date;

    switch(type) {
      case 'year':
        newDate = new Date(year - amount, month, day);
        return super.transform(newDate, "yyyyMMddhhmmss");
      case 'month':
        newDate = new Date(year, month - amount, day);
        return super.transform(newDate, "yyyyMMddhhmmss");
      case 'day':
        newDate = new Date(year, month, day - amount);
        return super.transform(newDate, "yyyyMMddhhmmss");
    }
  }
}
