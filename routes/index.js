var express = require('express');
var router = express.Router();
const {unlinkSync}  = require("fs")
const {extname}  = require("path")
const xlsx = require("xlsx")
const multer = require("multer")
const path = require("path")
const amountPerHour = 100;
const currencySymbol = "$"
/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Employees Payroll' });
});

router.post("/bulk_upload", async (req, res, next) => {
  try {
      // if (req.user.role == "user") {
      //     throw new Error("user", "Only Admin can upload the bulk Listings, No Permissions to upload.")
      // }
      const storage = multer.diskStorage({ //multers disk storage settings
          destination: (req, file, cb) => {
              cb(null, path.join(__dirname, 'uploads'))
          },
          filename: (req, file, cb) => {
              let datetimestamp = Date.now();
              cb(null, file.fieldname + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length - 1])
          }
      });
      const upload = multer({ //multer settings
          storage: storage
      });
      upload.single('file')(req, res, (err) => {
          next(err);
      });
  } catch (err) {
      console.error(err)
      next(err);
  }
}, async (req, res, next) => {
  try {
      console.log("started reading file")
      if(!req.file || !req.file.path){
        throw new Error(`Please upload valid file`)
      }
      if (!['.xlsx', ".csv"].includes(extname(req.file.path))) {
          unlinkSync(req.file.path);
          throw new Error( `please upload valid xlsx file`)
      }
      const filePath = req.file.path
      function convertDate(inputFormat) {
        function pad(s) { return (s < 10) ? '0' + s : s; }
        var d = new Date(inputFormat)
        return [pad(d.getDate()), pad(d.getMonth()+1), d.getFullYear()].join('/')
      }
      function uploadExcel(file) {
        if (!['.xlsx', ".csv"].includes(extname(filePath))) {
          unlinkSync(filePath);
          throw new Error(`please upload valid xlsx file`)
        }
        // read the number of records and create a job to process the entire file
        // var range = xlsx.utils.decode_range(worksheet['!fullref']);
        let workBook = xlsx.readFile(filePath);
        xlsx.writeFile(workBook, filePath)
        unlinkSync(filePath);
        if (!workBook.SheetNames) {
          throw new Error("not a valid sheet")
        }
        let data = xlsx.utils.sheet_to_json(workBook.Sheets[workBook.SheetNames[0]])
        let uniqueIds = Array.from(new Set(data.map((doc)=>doc["employee id"])))
        const newData = uniqueIds.map((id)=>{
            const records = data.filter((doc)=>doc["employee id"]==id).map((doc)=>{
              var dateParts = null
              var excelDate = null
              if(typeof doc.date == "string"){
                dateParts =  doc.date.split("/") 
              }
              if(typeof doc.date == "number"){
                excelDate = new Date((excelDate - (25567 + 1))*86400*1000).getTime();
              }
              var dateObject = (dateParts && dateParts.length) ? new Date(+dateParts[2], dateParts[1] - 1, +dateParts[0]).getTime(): excelDate; 
              doc.formatedDate = dateObject
              doc.hoursWorked = doc["hours worked"]
              return doc
            }).sort((a,b)=>a.formatedDate - b.formatedDate)
            const startDate = (typeof records[0].date == "string") ? records[0].date :  convertDate(new Date((records[0].date - (25567 + 1))*86400*1000).getTime());
            const endDate  = (typeof records[records.length-1].date == "string") ? records[records.length-1].date :  convertDate(new Date((records[records.length-1].date - (25567 + 1))*86400*1000).getTime()); 
            const amountPaid =  records.reduce((a, {hoursWorked}) => a + hoursWorked, 0);
            return {employeeId:id,payPeriod:{startDate,endDate,amountPaid:amountPerHour*amountPaid+"$",hoursWorked:amountPaid,perHourCost:amountPerHour+"$ per hour"}}
        })
        return newData
      }
      const result = await uploadExcel(req.file.path)
      res.status(200).send(result)
  } catch (error) {
      next(error);
  }
});


module.exports = router;
