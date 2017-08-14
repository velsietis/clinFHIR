
angular.module("sampleApp")
    .controller('orionTestCtrl',
        function ($scope,$http,$sce,resourceCreatorSvc,logicalModelSvc,appConfigSvc,GetDataFromServer) {
            $scope.input = {};

            $scope.input.showAllMappings = false;
            $scope.isArray = angular.isArray;

            var url=appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition?kind=logical&identifier=http://clinfhir.com|author&_summary=true";

            GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(
                function(data) {

                    $scope.input.LMUrl = "http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhEncounter";

                    $scope.bundleModels = [];
                    data.data.entry.forEach(function (ent) {
                        $scope.bundleModels.push(ent.resource.url);
                       // if (ent.resource.url == "http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhEncounter")
                    });
                    $scope.bundleModels.sort();


                   // $scope.LMUrl = $scope.input.bundleModels[deflt]


                },
                function(err) {
                    alert('Unable to load Logical Models');
                    console.log(err)
                }
            );

            $scope.selectLM = function(url) {
                console.log(url)
               // $scope.input.LMUrl = url;
                getMappingFile(url)
            };

            function getMappingFile(url) {
                logicalModelSvc.getMappingFile(url).then(
                    function(data) {
                        console.log(data)
                        $scope.currentMap = data;
                        delete $scope.results;
                    },
                    function(err) {
                        alert('Unable to get map from Logical Model')
                        console.log(err)
                    }
                );
            }

            getMappingFile();   //the default (encounter)

            function displayAnalysis(results) {
                //build a map of v2 map by segment (
                $scope.v2FieldMap = {}
                results.map.forEach(function (map) {
                    var v2 = map.v2;
                    var ar = v2.split('.');
                    var segmentName = ar[0];
                    $scope.v2FieldMap[segmentName] = $scope.v2FieldMap[segmentName] || [];
                    $scope.v2FieldMap[segmentName].push(map)
                })

               // console.log($scope.v2FieldMap)
            }

            $http.get('artifacts/v2FieldNames.json').then(
                function(data) {
                    $scope.v2FieldNames = data.data;
                }
            );

            $http.get('artifacts/v2DataTypes.json').then(
                function(data) {
                    $scope.v2Datatypes = data.data;
                   // console.log($scope.v2Datatypes)
                }
            );

            $http.get('orionTest/getSamples').then(
                function(data) {
                    $scope.samples = data.data;
                   // console.log($scope.samples)
                }
            );

            $scope.selectSample = function(sample,type) {
                $scope.sampleType = type;
                if (type == 'hl7') {
                    $scope.selectedHL7Sample = sample;
                } else {
                    $scope.selectedFHIRSample = sample;
                }

               // console.log(sample)
            };

            $scope.loadFile = function () {
                var selectedFile = document.getElementById('inputFileName').files[0];
                console.log(selectedFile);
                var reader = new FileReader();
                reader.readAsText(selectedFile)

                reader.onload = function(e) {
                    $scope.$apply(function() {
                       // $scope.fileToUpload = reader.result;

                        var contents = reader.result;
                        if (contents.substr(0,1) == '{') {
                            //assume this is a fhir resource
                            $scope.uploadType = 'fhir';

console.log(contents)
                            $scope.fileToUpload = contents;
                        } else {
                            //assume this is a v2 message
                            $scope.uploadType = 'hl7';
                            var ar = contents.split('\r');
                            console.log(ar)

                            $scope.fileToUpload = ar;
                        }


                        console.log(contents)



                        $scope.fileDescription = selectedFile.name;
                       // console.log(reader.result)
                    });
                };
            };


            $scope.executeJSONPathDEP = function(path) {
                delete $scope.FHIRPathResult;
               // var test = {"Encounter": $scope.dataFromServer.fhir}
                var url = "orionTest/executeFP?fp=" + path;
                $http.get(url).then(
                    function(data) {
                        console.log(data.data)
                        $scope.FHIRPathResult = data.data;
                    },
                    function (err){
                        console.log(err)
                    }
                );

/*
                var allElements = JSONPath({path:path,json:$scope.dataFromServer.fhir,flatten:true})
                $scope.JSONPathResult = allElements;
                console.log(allElements)
                */
            }

            //switch on the 'show all checkbox
            $scope.$watch(
                function() {return $scope.input.showAllMappings},
                function() {
                    console.log($scope.input.showAllMappings)


                    if ($scope.dataFromServer){
                        var fhir = $scope.dataFromServer.fhir;
                        var arHL7 = $scope.dataFromServer.arHL7;
                        var map = $scope.currentMap;//    dataFromServer.map;




                        $scope.results = performAnalysis(arHL7,fhir,map);
                    }


                });

            //get the files for the selected set...
            $scope.getFiles = function() {
                var url = 'orionTest/getFiles?hl7='+$scope.selectedHL7Sample._id + '&fhir='+ $scope.selectedFHIRSample._id;
                $http.get(url).then(
                    function(data) {
                        console.log(data)
                        $scope.dataFromServer = data.data;

                        var fhir = data.data.fhir;
                        var arHL7 = data.data.arHL7;
                        var map =  $scope.currentMap;//  data.data.map;

                        drawResourceTree(fhir)

                        $scope.results = performAnalysis(arHL7,fhir,map);
                        displayAnalysis($scope.results)
                        console.log($scope.results)
                        $scope.analysisOutcome = "Analysis Complete."
                        //alert('Analysis complete. View the tabs for details.')
                    },function(err) {
                        $scope.analysisOutcome = "Analysis Error."
                        alert("There as an error performing the analysis: "+ angular.toJson(err))
                        console.log(err)
                    }
                )
            };

            $scope.uploadFile = function () {

                var transmit = $scope.fileDescription || 'No description';

                if ($scope.uploadType == 'hl7') {
                    transmit += '%' + JSON.stringify($scope.fileToUpload);
                } else {
                    transmit += '%' + $scope.fileToUpload;
                }

                //var transmit = text + '%' + JSON.stringify($scope.fileToUpload);

                var url = "/orionTest/uploadFile";
                $http.post(url,btoa(transmit)).then(
                    function(data) {
                        console.log(data.data)
                        alert('File has been uploaded.')
                    },
                    function(err) {
                        alert('There was an error uploading the file: '+ angular.toJson(err));
                        console.log(err);
                    }
                )

            };

            function performAnalysis(arHl7,FHIR,Map) {

                if (!arHl7 || !FHIR || !Map) {
                    return
                }

                console.log(Map)

                var hashContained = {};

                //find the contained resources, and create a hash indexed on id...
                var arContained = JSONPath({path:'contained',json:FHIR})[0];    //returns an array of arrays...
                console.log(arContained);
                if (arContained) {
                    arContained.forEach(function (resource) {
                        hashContained[resource.id] = hashContained;
                    })
                }



                //generate an array to set the order of HL7 elements displayed  (see the sort below)
                var order = [];
                for (var i=0; i<arHl7.length;i++) {
                    var ar = arHl7[i].split('|');
                    order.push(ar[0]);
                }

                var vo = convertV2ToObject(arHl7);
                var hl7Hash = vo.hash;
                var hl7Msg = vo.msg;

                var response = {line:[]};

                response.fhir = FHIR;
                response.v2Message = hl7Msg;
               // response.v2String = arHl7;
                response.map = Map;

                var arResult = [];
                Map.forEach(function (item) {
                    var result = {description: item.description};
                    var v2Value = getFieldValue(hl7Hash,item.v2);

                    result.v2 = {key: item.v2, value: v2Value};

                    var include = false;
                    if ($scope.input.showAllMappings) {
                        include = true
                    }

                    if (v2Value && v2Value.values) {
                        v2Value.values.forEach(function (v) {
                            if (v !== "" && v!== undefined) {
                                include = true
                            }
                        })
                    }


                    //we need to remove the first segment in the path as it isn't present in the actual resource...
                    var fhirKey = item.fhir;
                    var ar = fhirKey.split('.');
                    ar.splice(0,1);
                    var pathInHostResource = ar.join('.');


                    //console.log(fhirKey,ar.join('.'))
                    var fhirValue;

                    var ar1 = pathInHostResource.split('[')        //has this path got a predicate? [...]
                    if (ar1.length > 1) {
                        //this path has a [] jsonPath predicate expression.



                        var expression = ar1[1].substr(0,ar1[1].length -1); //the expression - eg type.coding.code='ATND'
                        var arE = expression.split('=');
                        var expressionPath = arE[0];
                        var expressionValue = arE[1];
                        var parentPath = (ar1[0]).replace(/ /g,'');
                        if (expressionPath.substr(0,3)== 'ref') {
                            fhirValue = JSONPath({path:parentPath,json:FHIR})   //<< temp

                            //find the 'reference' elements in the current node...
                            var references = JSONPath({path:parentPath,json:FHIR,flatten:true})


                            //this expression is to an external resource - eg Location.physicalType.text in Encounter

                           // expressionPath = expressionPath.substr(3);  //strip of the 'ref '
                            //var ar2 = expressionPath.split('.')     //the resource type is included...
                            //var resourceType = ar2[0];
                            //now find contained resources of this

                        } else {
                            //this expression references something in the current node - eg Participant in Encounter
                           // var parentPath = (ar1[0]).replace(/ /g,'');

                            var allElements = JSONPath({path:parentPath,json:FHIR,flatten:true})
                            console.log(allElements)

                            allElements.forEach(function (el) {

                                var results = JSONPath({path:expressionPath,json:el})
                                if (results) {
                                    results.forEach(function (r) {
                                        if (r == expressionValue) {
                                            fhirValue = el;//JSONPath({path:pathInHostResource,json:FHIR})
                                            include = true;
                                        }
                                    })
                                }
                            })
                        }

                    } else if (item.fhirPath) {

                        console.log(item.fhirPath);
                        var url = "orionTest/executeFP";

                        var data = {path: item.fhirPath,resource:FHIR}
                         $http.post(url,data).then(
                             function(data) {
                                //console.log(data.data)
                                 //fhirValue = data.data[0];
                                 result.fhir = {key: item.fhir, value: data.data[0],fhirPath:item.fhirPath}
                                 response.line.push(result)

                                 console.log(fhirValue)
                                // include = true
                             },
                             function (err){
                                 //alert();
                                console.log(err)
                             }
                         );

                    } else {
                        //nope - a straight path...
                        fhirValue = JSONPath({path:pathInHostResource,json:FHIR})

                    }


                    if (fhirValue && fhirValue.length > 0) {
                        include = true
                    }

                    result.fhir = {key: item.fhir, value: fhirValue};
                    include = true;

                    if (include) {
                        response.line.push(result)
                    }

                });


                //console.log(order);
                response.line.sort(function (a,b) {

                    //console.log(b.v2.key)
                    return order.indexOf(a.v2.key.substr(0,3)) - order.indexOf(b.v2.key.substr(0,3));
  /*
                    if (a.v2.key > b.v2.key) {
                        return 1
                    } else {return -1}
*/

                })

                return response;

                //return the value of this field. - field name is like PV1-7.9.2
                function getFieldValue(hl7Hash,fieldName) {

                    var response = {values:[]}

                    var ar = fieldName.split('-');
                    var segmentCode = ar[0];                //eg PV1
                    var fieldNumberAsString = ar[1];         //eg 7.9.2
                    var fieldNumber = parseInt(ar[1],10);   //eg 7

                    var segments = hl7Hash[segmentCode]     //each segment is a full seg,ent - eg a PV1...
                    if (! segments) {
                        return
                    }
                    //var arValues = [];      //there can be more than one...
                    segments.forEach(function(seg){
                        //seg is a single segment...
                        var fieldValue = seg[fieldNumber];       //the field value as a string
                        response.fullValue = fieldValue;
                        var ar1 = fieldNumberAsString.split('.');
                        switch (ar1.length) {
                            case 1 :                        //full field
                                response.values.push(fieldValue)
                                break;
                            case 2 :                        //sub value - eg 7.9
                                if (fieldValue) {
                                    var arSubvalue = fieldValue.split('^');
                                    if (arSubvalue.length >= ar1[1]-1) {
                                        response.values.push(arSubvalue[ar1[1]-1])
                                    }
                                }
                                break;
                            case 3 :                        //sub-sub value - eg 7.9.2

                                if (fieldValue) {
                                    var arSubvalue = fieldValue.split('^');
                                    if (arSubvalue.length >= ar1[1]-1) {

                                        var l2Value = arSubvalue[ar1[1]-1];     //the value at the second level. now to split on '&'
                                        var ar3 = l2Value.split('&');
                                        var posInField = ar1[2];
                                        if (posInField <= ar3.length){
                                            response.values.push(ar3[posInField-1])
                                        }


                                    }
                                }
                                break;

                                /*if (fieldValue) {
                                    var arSubvalue = fieldValue.split('^');
                                    if (arSubvalue.length >= ar1[1]-1) {
                                        var subSubValue = ar1[1]-1;
                                        if (subSubValue) {
                                            var arSS = subSubValue.split('&');
                                            if (arSS.length >= ar1[2]-1) {
                                                response.values.push(arSS[ar1[2]-1])
                                            }
                                        }




                                    }
                                }
                                */

                                break;
                        }

                    })
                    return response;
                }


                function convertV2ToObject(arHl7) {
                    var hash = {}
                    var arMessage = [];
                    arHl7.forEach(function(line){
                        var arLine = line.split('|');
                        var segmentName = arLine[0];
                        hash[segmentName] = hash[segmentName] || []
                        hash[segmentName].push(arLine);

                        //the MSH counting is different as the separator bar (|) is not yet defined...
                        if (arLine[0] == 'MSH') {
                            arLine.splice(1,0,'|')
                        }
                        arMessage.push(arLine)

                    });

                    console.log(hash);
                    return {hash:hash,msg:arMessage};


                }
            }



            $scope.selectSegment = function(segment){
                $scope.currentSegment = segment;
                $scope.currentV2Fields = $scope.v2FieldNames[segment[0]];
                //console.log($scope.currentV2Fields)
            };

            //return a display for a popover of v2 data
            $scope.decomposeData = function(dt,data) {
               // console.log(dt,data);
                var ar = []
                if (data) {
                    ar = data.split('^')
                }

                var details = $scope.v2Datatypes[dt];
                //console.log(details)
                if (details) {
                    var display = "";

                    details.fieldName.forEach(function (fld,inx) {
                        if (ar[inx]) {
                            display += fld.name + "=" + ar[inx] + "<br/>";
                        }
                    })




                    return display;
                } else {
                    return dt
                }


            }

            $scope.showDT = function(dt) {

                var details = $scope.v2Datatypes[dt];

                if (details) {
                    var display = "";
                    details.fieldName.forEach(function (fld) {
                        display += fld.name + " ("+ fld.type +  ")<br/>";
                    })

                    if (display) {
                        display = display.substring(0,display.length -5)
                    }

                    return display;
                } else {
                    return dt
                }

            }


            $scope.showHl7Desc = function(key) {

                var ar = key.split('-')
                var segName = ar[0];
                var ar1 = ar[1].split(' ');
                var fieldNumber = ar1[0];
                var names = $scope.v2FieldNames[segName];
                if (names) {
                    var txt = names.fieldName[fieldNumber]
                    if (txt) {
                        return txt.name;
                    }

                }




               // $scope.v2FieldNames


                return key + " " + segName + " "+ fieldNumber;


            }

            $scope.showRowDEP = function(item) {
                //console.log(item)
                if ($scope.input.showAllMappings) {
                    return true;
                } else {
                    if (item.v2.value && item.v2.value.values.length > 0) {
                        return true;
                        /*item.v2.value.values.for(function (v) {
                            if (v) {
                                return true;
                            }
                        })*/

                    }
                }
                return false;
            }


            function drawResourceTree(resource) {
                var treeData = resourceCreatorSvc.buildResourceTree(resource);

                treeData.forEach(function (item) {
                    item.state = item.state || {}
                    item.state.opened = false;
                })

                //show the tree of this version
                $('#resourceTree').jstree('destroy');
                $('#resourceTree').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                )


/*
                $('#graphResourceTree').jstree('destroy');
                $('#graphResourceTree').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                )
                */


            }

    }).filter('dropFirst', function() {
    return function(path) {
        if (path) {
            var ar = path.split('.')
            ar.splice(0,1);
            return ar.join('.')
        }


    }
})
