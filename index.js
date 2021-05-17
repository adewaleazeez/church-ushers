'use strict'

var express = require('express');

var port = process.env.PORT || 3000;

var app = express();
var bodyParser = require('body-parser');
var mysql = require('node-mysql') ;
var multer = require('multer');
var path = require('path');
var cors = require('cors')
var nodemailer = require('nodemailer');

const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;
const electron = typeof process !== 'undefined' && process.versions && !!process.versions.electron;
 
console.log(ThermalPrinter)
console.log(PrinterTypes)
console.log(electron)

// Printit();

var Printit = async () => {
    // return new Promise((resolve, reject)=>{

        let printer = new ThermalPrinter({
            type: PrinterTypes.STAR,                                  // Printer type: 'star' or 'epson'
            interface: 'printer: BIXOLON',                            // Printer interface
            characterSet: 'SLOVENIA',                                 // Printer character set - default: SLOVENIA
            removeSpecialCharacters: false,                           // Removes special characters - default: false
            lineCharacter: "=",                                       // Set character for lines - default: "-"
            driver: require(electron ? 'electron-printer' : 'star'),
            options:{                                                 // Additional options
            timeout: 5000                                           // Connection timeout (ms) [applicable only for network printers] - default: 3000
            }
        });
        
        let isConnected = await printer.isPrinterConnected();       // Check if printer is connected, return bool of status
        // console.log(isConnected);
        
        let execute = await printer.execute();                      // Executes all the commands. Returns success or throws error
        let raw = await printer.raw(Buffer.from("Hello world"));    // Print instantly. Returns success or throws error
        printer.print("Hello World");                               // Append text
        printer.println("Hello World");                             // Append text with new line
        printer.openCashDrawer();                                   // Kick the cash drawer
        printer.cut();                                              // Cuts the paper (if printer only supports one mode use this)
        printer.partialCut();                                       // Cuts the paper leaving a small bridge in middle (if printer supports multiple cut modes)
        printer.beep();                                             // Sound internal beeper/buzzer (if available)
        printer.upsideDown(true);                                   // Content is printed upside down (rotated 180 degrees)
        printer.setCharacterSet("SLOVENIA");                        // Set character set - default set on init
        printer.setPrinterDriver(Object)                            // Set printer drive - default set on init
    // })
        
}
 
/*************************************************8************ */

var mailer = require('./mailer/mailer');
var urlencodedParser = bodyParser.urlencoded({extended: false});
// var isBase64 = require('is-base64');

  
var http = require('http');
var publicPath = path.join(__dirname, 'public');

var htmlPath = path.join(__dirname, 'views/html');
// var uploadPath = path.join('/var/www/html/sprimages/');

// console.log(path)
// console.log(uploadPath)

var socketIO = require('socket.io');
var server = http.createServer(app);
/** instantiate socket.io here */
var io = socketIO(server);

var fs = require('fs');

// var upload = multer({ dest: 'uploads/' })

/** Database Connections Handle */
var DataBasepool = require('./connections/connection');


var getAlltotal = require('./utilities/getTotalBoardContent');
var dateFormat = require('dateformat');
// var cors = require('cors');
var outResultArray = [];


// ================================================================
// setup our express application
// ================================================================
// app.set('view engine', 'html');
// app.use('public', express.static(process.cwd() + 'public'));
// app.engine('html', require('ejs').renderFile);
 
app.set('views', __dirname);

// app.use(express.static(publicPath));

app.use(express.static(htmlPath));
// app.use(cors());

app.set('socketio', io);

app.use(cors())


app.use(function(req, res, next){
    res.header('Access-Control-Allow-Origin', "*");
    // res.header('Access-Control-Allow-Origin', "75.127.75.161:4000");
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

/** ROUTE Setup starts here */

app.get('/', function(req, res) {
    res.sendFile(htmlPath+('/login.html'));
    // res.sendFile('html/login');

    // Printit();
});

app.get('/userinfo', (req, res) => {
    var user = req.query.user;
    var pass = req.query.pass;

    console.log(user+":::"+pass)

    DataBasepool.getConnection((err, connection) => {
        if(err){
            console.log(err)
            res.send(err);
            return;
        }

        connection.query("select * from webusers where usermail = ? and passkey = ? and status='ACTIVE' ", [user, pass], (err, result, fields) => {
            if(err){
                console.log(err)
                res.json({error: err, status: 'error'});
                return;
            }
            connection.release();


            var name="", roleId="", userId="", status='error';

            result.forEach((row) => {
                name = row.fname + " " + row.lname;
                roleId = row.access_level;
                userId = row.usermail;
                status='success';

            });

            var outObject = {
                name: name,
                roleId: roleId,
                userId: userId,
                status: status
            };

            res.json(outObject);
        });

        

    });

});

app.post('/menu', urlencodedParser, function(req, res){  
    var user = req.body.username;
    var pass = req.body.password;
    var valuestr="empty"
    //  console.log(user);
    //  console.log(pass);
  
    DataBasepool.getConnection(function(err, connection){
      if (err){
        res.send(err.sqlMessage);
        return;
      }
      
      connection.query("select * from webusers where usermail = ? AND passkey = ?", [user, pass], function (err, result, fields) {
        if (err){
          res.send(err);
          return connection.rollback(function(){
          //   connection.release();
          })
        }
        // console.log(result)            
  
        result.forEach(function(row) { 
          valuestr = row.FullName; 
        });  
        // console.log(valuestr)
        if(valuestr=='empty'){
          res.sendFile(htmlPath+'/404.html')  
        }else{
          console.log(htmlPath)
          res.sendFile(htmlPath+'/board.html');
        }
        //socket.emit('tracked', result)
        // return result
      });
      connection.release()
  
    })
  
});

app.get('/getexistingdata', (req, res)=>{
    var month = req.query.month;
    var year = req.query.year;
    DataBasepool.getConnection((err, connection)=>{
        if(err){
            res.json({error: err, status: 'error'});
            return
        }

        /** ALL already entered data combination */
        var sql = "select a.refnos, a.dated, g.`description` as GRP, a.mth, w.`description` as wing, a.`service_id`, a.user_id, a.year from allocator_tbl a inner join `groups_tbl` g ON a.`group_id`= g.`refnos`, wings_tbl w where mth=? and year = ? and a.`wing_id` = w.`refnos`";
        connection.query(sql, [month, year], (err, result)=>{
            if(err){
                res.json({error: err, status: 'error'})
                return;
            }

            /** Wings Drop down List */
            connection.query('select * from wings_tbl', (err, wingsRS)=>{
                if(err){
                    res.json({error: err, status: 'error'})
                    return;
                }

                /** Group Drop down list */
                connection.query('select * from groups_tbl', (err, groupRS)=>{
                    if(err){
                        res.json({error: err, status: 'error'})
                        return;
                    }

                    connection.release();

                    var wingHtml = "<option value='" +0+ "'>"+"Please, Select a wing....."+"</option>.....";
                    wingsRS.forEach(function(row) { 
                        wingHtml += "<option value='" + row.refnos + "'>";
                        wingHtml += row.description;  
                        wingHtml += "</option>";
                    });
    
                    var groupHtml = "<option value='" +0+ "'>"+"Please, Select a wing....."+"</option>.....";
                    groupRS.forEach(function(row) { 
                        groupHtml += "<option value='" + row.refnos + "'>";
                        groupHtml += row.description;  
                        groupHtml += "</option>";
                    });

                    var recs=0, status;
                    var str = "<table class='table table-bordered' >";
                    str += "<tr> <td>S/N</td> <td>Month</td> <td>Wing</td> <td>Group</td> <td>Service</td> </tr>";

                    var mth, service
                    var service_description, mth_name
                    result.forEach((row)=>{
                        recs++;
                        status=row.status;
                        mth = row.mth;
                        service = row.service_id;
                        if(service==1){
                            service_description = "First Service"
                        }else if(service==2){
                            service_description = "Second Service"
                        }else if(service==3){
                            service_description = "Third Service"
                        }else if(service==4){
                            service_description = "Fourth Service"
                        }

                        if(mth==1){
                            mth_name = "January"
                        }else if(mth==2){
                            mth_name = "February"
                        }else if(mth==3){
                            mth_name = "March"
                        }else if(mth==4){
                            mth_name = "April"
                        }else if(mth==5){
                            mth_name = "May"
                        }else if(mth==6){
                            mth_name = "June"
                        }else if(mth==7){
                            mth_name = "July"
                        }else if(mth==8){
                            mth_name = "August"
                        }else if(mth==9){
                            mth_name = "September"
                        }else if(mth==10){
                            mth_name = "October"
                        }else if(mth==11){
                            mth_name = "November"
                        }else if(mth==12){
                            mth_name = "December"
                        }

                        str += "<tr id="+ row.refnos +" onclick='clicked(this.id)'><td>"+ recs +"</td><td>"+ mth_name +"</td><td>"+ row.wing +"</td> <td>"+ row.GRP +"</td> <td>"+ service_description +"</td> <td><button type='button' class='btn btn-danger' tooltip='Click to delete the question' id='"+ row.refnos +"' onclick='deleteCombo(this.id)' ><span><i class='fa fa-trash-o' ></i>Delete</span></button> </td></tr>";
                        // str += "<tr id="+ row.refnos +" onclick='clicked(this.id)'><td>"+ recs +"</td><td>"+ row.question +"</td><td><button type='button' class='btn btn-success' tooltip='Add Option to question to be selected by users' id='"+ row.refnos +"' value='"+ row.question +"' onclick='openoptions(this.id, this.value)' >Options</button> </td><td><button type='button' class='btn btn-primary' tooltip='Click to edit the question' id='"+ row.refnos +"' onclick='editQuestion(this.id)' ><span><i class='fa fa-pencil' ></i> </span></button></td><td><button type='button' class='btn btn-primary' tooltip='Click to add options condition' value='"+ row.question +"'  id='"+ row.refnos +"' onclick='questionCondition (this.id, this.value)' ><span><i class='fa fa-control' ></i> Condition</span></button></td> <td><button type='button' class='btn btn-danger' tooltip='Click to delete the question' id='"+ row.refnos +"' onclick='deleteQuestion(this.id)' ><span><i class='fa fa-trash' ></i></span></button> </td></tr>";
                
                    })


                    str += "</table>";
        
        

                    res.json({
                        wing: wingHtml,
                        group: groupHtml,
                        str: str
                    })

    
                })

            })

        })
    }) 
})

app.get('/insertallocator', (req, res) => {
    var year = req.query.year;
    var month = req.query.mth;
    var wing = req.query.wing;
    var group = req.query.group;
    var service = req.query.service;
    var user = "Dele";

    DataBasepool.getConnection((err, connection)=>{
        if(err){
            res.json({error: err, status: 'error'})
            return;
        }

        connection.query('insert into allocator_tbl (group_id, mth, wing_id, service_id, user_id, year) values(?, ?, ?, ?, ?, ?)', [group, month, wing, service, user, year], (err, result)=>{
            if(err){
                res.json({error: err, status: 'error'})
                return;
    
            }

            var sql = "select a.refnos, a.dated, g.`description` as GRP, a.mth, w.`description` as wing, a.`service_id`, a.user_id, a.year from allocator_tbl a inner join `groups_tbl` g ON a.`group_id`= g.`refnos`, wings_tbl w where mth=? and year = ? and a.`wing_id` = w.`refnos`";
        
            connection.query(sql, [month, year], (err, resultRS)=>{
                if(err){
                    res.json({error: err, status: 'error'})
                    return;
        
                }

                connection.release();

                var recs=0, status;
                var str = "<table class='table table-bordered' >";
                str += "<tr> <td>S/N</td> <td>Month</td> <td>Wing</td> <td>Group</td> <td>Service</td> </tr>";

                var mth, service
                var service_description, mth_name
                resultRS.forEach((row)=>{
                    recs++;
                    status=row.status;
                    mth = row.mth;
                    service = row.service_id;
                    if(service==1){
                        service_description = "First Service"
                    }else if(service==2){
                        service_description = "Second Service"
                    }else if(service==3){
                        service_description = "Third Service"
                    }else if(service==4){
                        service_description = "Fourth Service"
                    }

                    if(mth==1) {
                        mth_name = "January"
                    }else if(mth==2) {
                        mth_name = "February"
                    }else if(mth==3) {
                        mth_name = "March"
                    }else if(mth==4) {
                        mth_name = "April"
                    }else if(mth==5) {
                        mth_name = "May"
                    }else if(mth==6) {
                        mth_name = "June"
                    }else if(mth==7) {
                        mth_name = "July"
                    }else if(mth==8) {
                        mth_name = "August"
                    }else if(mth==9) {
                        mth_name = "September"
                    }else if(mth==10) {
                        mth_name = "October"
                    }else if(mth==11) {
                        mth_name = "November"
                    }else if(mth==12) {
                        mth_name = "December"
                    }

                    str += "<tr id="+ row.refnos +" onclick='clicked(this.id)'><td>"+ recs +"</td><td>"+ mth_name +"</td><td>"+ row.wing +"</td> <td>"+ row.GRP +"</td> <td>"+ service_description +"</td> <td><button type='button' class='btn btn-danger' tooltip='Click to delete the question' id='"+ row.refnos +"' onclick='deleteCombo(this.id)' ><span><i class='fa fa-trash-o' ></i>Delete</span></button> </td></tr>";
                    // str += "<tr id="+ row.refnos +" onclick='clicked(this.id)'><td>"+ recs +"</td><td>"+ row.question +"</td><td><button type='button' class='btn btn-success' tooltip='Add Option to question to be selected by users' id='"+ row.refnos +"' value='"+ row.question +"' onclick='openoptions(this.id, this.value)' >Options</button> </td><td><button type='button' class='btn btn-primary' tooltip='Click to edit the question' id='"+ row.refnos +"' onclick='editQuestion(this.id)' ><span><i class='fa fa-pencil' ></i> </span></button></td><td><button type='button' class='btn btn-primary' tooltip='Click to add options condition' value='"+ row.question +"'  id='"+ row.refnos +"' onclick='questionCondition (this.id, this.value)' ><span><i class='fa fa-control' ></i> Condition</span></button></td> <td><button type='button' class='btn btn-danger' tooltip='Click to delete the question' id='"+ row.refnos +"' onclick='deleteQuestion(this.id)' ><span><i class='fa fa-trash' ></i></span></button> </td></tr>";
            
                })


                str += "</table>";
    
                res.json({
                    str: str,
                    status: status
                })
                
            })
        })
    })

})

app.get('/deleteCombo', (req, res)=>{
    var id = req.query.questionid;

    console.log("Code: "+id)
    DataBasepool.getConnection((err, connection)=>{
        if(err){
            res.json({error: err, status: 'error'})
            return
        }

        connection.query('delete from allocator_tbl where refnos = ?', [id], (err, result)=>{
            if(err){
                res.json({error: err, status: 'error'})
                return
            }

            connection.release();

            res.json({str: result})

        })
    })
})

app.get('/getmemberDetails', (req, res)=>{
    var id = req.query.id;
    var dated = dateFormat(new Date, 'yyyy-mm-dd')

    DataBasepool.getConnection((err, connection)=>{
        if(err){
            res.json({error: err.sqlMessage, status: 'error'})
            console.log(err.sqlMessage)
            return
        }

        connection.query('insert into clockin_tbl(member_id, dates) values(?, ?)', [id, dated], (err, resultRS)=>{
            if(err){
                console.log(err.sqlMessage)
                res.json({error: err.sqlMessage, status: 'error'})
                return
            }

            var ins_id

            console.log(resultRS)
            ins_id = resultRS.insertId
             
            connection.query('select * from members_tbl where refnos=?', [id], (err, result)=>{
                if(err){
                    console.log(err.sqlMessage)
                    res.json({error: err.sqlMessage, status: 'error'})
                    return
                }

                connection.query('select dated from clockin_tbl where refnos =?', [ins_id], (err, timeRS)=>{ // PICK check in time
                    if(err){
                        console.log(err.sqlMessage)
                        res.json({error: err.sqlMessage, status: 'error'})
                        return
                    }


                    connection.release();

                    
                    console.log(dateFormat(timeRS.dated, 'yyyy-mm-dd HH:MM:ss'));
        
                    res.json({
                        str: result,
                        timer: dateFormat(timeRS.dated, 'yyyy-mm-dd HH:MM:ss'),
                        newid: ins_id,
                        status: 'success'
                    })
                })
    
            })



        })
        

    })
})

var getMemberGroup = async (id) => {
    return new Promise((resolve, reject)=>{
        DataBasepool.getConnection((err, connection)=>{
            if(err){
                reject({error: err})
                return
            }

            connection.query("select m.`refnos`, m.`fname`, m.`lname`, m.`imagesURL`, m.`group_id`, m.`telephone`, m.`unit_id`, g.`description` as GRP, u.`description` as UNIT, m.`sex` from members_tbl m inner join `groups_tbl` g ON m.`group_id` = g.`refnos`, `units_tbl` u where m.refnos = ? and m.`unit_id` = u.`refnos`", [id], (err, result)=>{
                if(err){
                    reject({error: err})
                    return
                }
                connection.release();

                var grpid=0;
                var fname, grp_name, uname, sex;
                result.forEach((row)=>{
                    grpid = row.group_id;
                    fname = row.fname +' '+row.lname;
                    grp_name = row.GRP;
                    uname = row.UNIT;
                    sex = row.sex; 
                })

                resolve({group: grpid, fname: fname, grp_name: grp_name, unit: uname, sex: sex});
            })
        })
    })
}

var getAllocationAI = async (group_id, mth, yr) => {
    return new Promise((resolve, reject)=>{
        DataBasepool.getConnection((err, connection)=>{
            if(err){
                reject({error: err})
                return
            }

            connection.query('select * from allocator_tbl where group_id = ? and mth = ? and year = ?', [group_id, mth, yr], (err, result)=>{
                if(err){
                    reject({error: err})
                    return
                }
                connection.release();

                var grpid=0;
                // result.forEach((row)=>{
                //     grpid = row.group_id;
                // })

                resolve(result);
            })
        })
    })
}

var getWingsInfo = async (wing_id) => {
    return new Promise((resolve, reject)=>{
        DataBasepool.getConnection((err, connection)=>{
            if(err){
                reject({error: err})
                return
            }

            connection.query('select * from wings_tbl where refnos = ?', [wing_id], (err, result)=>{
                if(err){
                    reject({error: err})
                    return
                }
                connection.release();

                var grpid=0;
                // result.forEach((row)=>{
                //     grpid = row.group_id;
                // })

                resolve(result);
            })
        })
    })
}

var getTotalMemberInPosition = async (wing_id, current_mnth, current_year) => {
    return new Promise((resolve, reject)=>{
        DataBasepool.getConnection((err, connection)=>{
            if(err){
                reject({error: err})
                return
            }

            connection.query('select count(`member_id`) as counted from allocation_history_tbl a where a.`wing_id` = ? and a.`mth` = ? and year = ?', [wing_id, current_mnth, current_year], (err, result)=>{
                if(err){
                    reject({error: err})
                    return
                }
                connection.release();

                var counted=0;
                result.forEach((row)=>{
                    counted = row.counted;
                })

                resolve(counted);
            })
        })
    })
}

var insertWorkerPostingAllocation = async (id, wing_id, service_id, current_mnth, current_year, newref, seatno) => {
    return new Promise((resolve, reject)=>{
        DataBasepool.getConnection((err, connection)=>{
            if(err){
                reject({str: err})
                return
            }
            
            connection.query('insert into allocation_history_tbl(member_id, wing_id, service_id, mth, year, seatno, clock_refpt) values(?, ?, ?, ?, ?, ?, ?)', [id, wing_id, service_id, current_mnth, current_year, seatno, newref ], (err, insRS)=>{
                if(err){
                    reject({str: "No more point available in Wing..."})
                    return

                }
                connection.release();

                // console.log(insRS)
                resolve(
                    insRS
                )
            })

        })
    })
}
var insertAllocatedseat = async (id, seatno) => {
    return new Promise((resolve, reject)=>{
        DataBasepool.getConnection((err, connection)=>{
            if(err){
                reject({str: err})
                return
            }
            
            connection.query('insert into allocated_seatno(allocated_refpt, seatno) values(?, ?)', [id, seatno ], (err, insRS)=>{
                if(err){
                    reject({str: "Insert failed..."})
                    return

                }
                connection.release();

                // console.log(insRS)
                resolve(
                    insRS
                )
            })

        })
    })
}

var checkseatavailability = async (wing_id, sex) => {
    return new Promise((resolve, reject)=>{
        DataBasepool.getConnection((err, connection)=>{
            if(err){
                reject({str: err.sqlMessage})
                return
            }
            var sql = "";
            console.log(sex)
            console.log(wing_id)

            if (sex=="Male") {
                sql = "select * from points_tbl as p where not exists( select * from allocated_seatno as a where p.`refnos` = a.`allocated_refpt` ) and p.`wing_id` = ? order by wing_id, refnos";
            } else {
                sql = "select * from points_tbl as p where not exists( select * from allocated_seatno as a where p.`refnos` = a.`allocated_refpt` ) and p.`wing_id` = ?  and p.sex !='Male' order by wing_id, refnos";
            }
            
            connection.query(sql, [wing_id], (err, allocRS)=>{
                if(err) {
                    reject({str: err.sqlMessage})
                    return

                }
                connection.release();

                // console.log(allocRS.length)
                resolve(
                    allocRS
                )
            })

        })
    })
}


app.get('/allocatemember', async (req, res)=>{
    var id = req.query.member;
    var newref = req.query.newref;
    var timer = req.query.timer;
    
    var current_year = new Date().getFullYear();
    var current_mnth = new Date().getMonth() + 1;

    /** GET the Member group for referencing */
    var group_id = await getMemberGroup(id); //group: grpid, fname: fname, grp_name: grp_name, unit: uname

    var memberSex = group_id.sex

    /** GET the Allocation AI data for wing and services data */
    var allocationAI = await getAllocationAI(group_id.group, current_mnth, current_year);
// console.log(allocationAI)
    var wing_id, service_id
    wing_id = allocationAI[0].wing_id;

    /** GET value to ensure there is no WING OVERLOAD with USHERS */
    var totalMemberInPosition = await getTotalMemberInPosition(wing_id, current_mnth, current_year);

    /** Contains wngs_tbl data */
    var wing_info = await getWingsInfo(wing_id);

    var wingTotal = wing_info[0].count;
    var wing_name = wing_info[0].description;

    /** CHECK FOR THE next seat for current member by passing its wing code
     *  and scanned member sex, to avoid giving the front row to FEMALE MEMBERS
     */ 
    var allocation_resp = await checkseatavailability(wing_id, memberSex); 

    // console.log(memberSex)
    // console.log(allocation_resp)

    if( allocation_resp.length > 0 ) {
        var seat_sex = allocation_resp[0].sex;

        var alloc_refpt  = allocation_resp[0].refnos;
        var alloc_seatno = allocation_resp[0].seatno;  

        var insAlloc = insertAllocatedseat(alloc_refpt, alloc_seatno);

        var servicesArray = [];


        var htmlstr = "<table class='table table-bordered' >"
        htmlstr += "<tr><td colspan='4' style='font-size: 16px; font-weight: bolder'>FAITH TABERNACLE</td></tr>"
        htmlstr += "<tr><td colspan='4' style='font-size: 14px; font-weight: bolder'>HEADING 2</td></tr>"
        htmlstr += "<tr><td style='font-size: 12px; font-weight: bolder'>Member Name :</td><td style='font-size: 13px'>" + group_id.fname    + "</td></tr>"
        htmlstr += "<tr><td style='font-size: 12px; font-weight: bolder'>Group Name :</td><td style='font-size: 13px'>"  + group_id.grp_name + "</td></tr>"
        
        htmlstr += "<tr><td style='font-size: 12px; font-weight: bolder'>Post WING :</td><td style='font-size: 13px'>"   + wing_name         + "</td></tr>"
        htmlstr += "<tr><td style='font-size: 12px; font-weight: bolder'>POST Date :</td><td style='font-size: 13px'>"   + timer             + "</td></tr>"
        // htmlstr += "<tr><td>Services :</td><td>" + + "</td></tr>"
        // htmlstr += "<tr><td>Services :</td><td>" + + "</td></tr>"

        var dat
        for( var x = 0; x < allocationAI.length; x++) 
        {
            var srv_no = allocationAI[x].service_id;

            /** CHANGE this implementation in the architecture. 
             *  Number of Services may increase later
             */
            if(srv_no==1) {
                dat = "First Service"
            }else if(srv_no==2) {
                dat = "Second Service"
            }else if(srv_no==3) {
                dat = "Third Service"
            }else if(srv_no==4) {
                dat = "Fourth Service"
            }
            

            var dataSet = await insertWorkerPostingAllocation(id, wing_id, srv_no, current_mnth, current_year, newref, alloc_seatno );

            servicesArray.push(dat);
            // servicesArray.push(" ");
            // console.log("Counter: "+x)
            // console.log(dataSet)
        }

        htmlstr += "<tr><td style='font-size: 12px; font-weight: bolder'>Allocated Seat No. :</td><td style='font-size: 13px'>"    + alloc_seatno      + "</td></tr>"
        htmlstr += "<tr><td style='font-size: 12px; font-weight: bolder'>Service(s) :</td><td style='font-size: 13px'>"            + servicesArray     + "</td></tr>"

        htmlstr += "</table>"

        res.json({
            str: dataSet,
            result: htmlstr,
            status: 'success'
        })


    }
    else 
    {
        res.json({
            str: dataSet,
            result: "No more posting for Scanned Member group...Post unavailable!!!",
            status: 'fail'
        })

    }
    
    
    
    // console.log(wingTotal)
    
})

  
app.get('/generateTimetable', (req, res)=>{
    DataBasepool.getConnection((err, connection)=>{
        if(err){
            res.json({errror: err, status: 'error'})
            return
        }

        /** Time Table SQL */
        var sql="";


    })
})




// ================================================================
// start our server
// ================================================================
server.listen(port, function() {
    // console.log('Server listening on port ' + port + '...');
    console.log(`Server listening on port ${port}`)
});

