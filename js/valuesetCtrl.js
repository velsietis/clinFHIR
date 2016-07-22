angular.module("sampleApp").controller('valuesetCtrl',
    function ($scope, Utilities, appConfigSvc,SaveDataToServer,GetDataFromServer,resourceCreatorSvc,modalService,
            $uibModal) {


    var snomedSystem = "http://snomed.info/sct";




    $scope.results = {};
    $scope.input = {};


    //register that the application has been started... (for reporting)
    resourceCreatorSvc.registerAccess();
        
    $scope.state = 'find';      // edit / new / find
    $scope.input.conceptCache = {};        //hash to store the lookup details of a concept. todo We could cache this...

    $scope.results.ccDirectSystem = "http://snomed.info/sct";     //default the system name to snomed



    //delete all the $scope properties created during processing
    function cleanUp() {
        delete $scope.searchResultBundle;
        delete $scope.message;
        delete $scope.vs;
        delete $scope.queryUrl;
        delete $scope.queryError;
    }


    //--------- terminology servers........
    var config = appConfigSvc.config();
    var termServ = config.servers.terminology;      //the currently configured terminology server

    //place all the v3 terminology servers into the array and set the default server ($scope.termServer)
    $scope.terminologyServers = [];
    config.terminologyServers.forEach(function(svr){
        if (svr.version == 3) {
            $scope.terminologyServers.push(svr);
            if (svr.url == termServ) {
                $scope.termServer = svr;    //note that termServ and $scope.termServer are only used in setting the dropwown. $scope.serverRoot is used elsewhere
            }
        }
    });




    //----- changing the terminology server...  This will update the local preference store...
    $scope.changeTerminologyServer = function(svr){
        appConfigSvc.setServerType('terminology',svr.url);  //set the new terminology server in $localStorage...

        $scope.serverRoot = svr.url;
        //delete the results from seaching from the previous server...
        cleanUp();
        $scope.state='find';
        
    };

    $scope.serverRoot = config.servers.terminology;
    //$scope.valueSetRoot = config.servers.terminology + "ValueSet/";
        //var qry = config.servers.terminology + "ValueSet/"+name+"/$expand?filter="+filter;

        //console.log(config.servers.terminology)
    var svr = appConfigSvc.getServerByUrl(config.servers.terminology);

    if (svr){
        if (svr.version <3) {

            modalService.showModal({},
                {bodyText:"Warning: this application needs to work with a Terminology Server supporting version 3 of FHIR"}).
                    then(function (result) {
                //this is the 'yes'
                $scope.displayMode = 'front';
                delete $scope.serverRoot;       //will disable edit controls....
            })
        }
    } else {
        alert("There was a unrecognized server url in the config: "+ config.servers.terminology)
    }


    $scope.arScopingValueSet = [];
    $scope.arScopingValueSet.push()
    $scope.showScopingValueSet = true;  //allows the scping valueset to be selected in the search...


    $scope.vsReference = true;      //to show the included file

    //var reference = "http://hl7.org/fhir/ValueSet/condition-code";
    var reference = "http://hl7.org/fhir/ValueSet/condition-cause";
                     //http://fhir3.healthintersections.com.au/open/ValueSet/condition-cause

    //make a copy of the current vs
    $scope.copyVs = function(){
        $scope.newVs($scope.vs);
        $scope.input.isDirty = true;
    };

    $scope.newVs = function(vs) {
        //delete $scope.vs;
        //delete $scope.searchResultBundle;
        cleanUp();
        $scope.state='new';

        $uibModal.open({
            backdrop: 'static',      //means can't close by clicking on the backdrop. stuffs up the original settings...
            keyboard: false,       //same as above.
            templateUrl: 'modalTemplates/inputValueSetName.html',
            size:'lg',
            controller: function($scope,GetDataFromServer,config,modalService,profileCreatorSvc,terminologyServers){
                //$scope.terminologyServers = terminologyServers;
                $scope.terminologyServer = config.servers.terminology;      //to display...
                $scope.input = {};
                $scope.checkName = function(name){
                    var url = config.servers.terminology + "ValueSet/"+name;
                    GetDataFromServer.adHocFHIRQuery(url).then(
                        function(){
                            //it found a valueset with that name
                            modalService.showModal({}, {bodyText: 'Sorry, this valueSet already exists.'})
                        },
                        function(err){
                            console.log(err);

                            if (! profileCreatorSvc.isSimpleString(name)){
                                modalService.showModal({}, {bodyText: 'This name has characters that may cause problems. I suggest you try a simpler one.'})
                            }


                            $scope.nameValid = true;
                        }
                    );


                }
                
                $scope.select = function() {
                    $scope.$close({name:$scope.input.name,description:$scope.input.description})
                }
                
            }, resolve : {
                config: function () {          //the default config
                    return config;

                },terminologyServers : function(){
                    console.log($scope.terminologyServers)
                    return $scope.terminologyServers;
                }
            }
        }).result.then(
            function(vo){

                console.log(vo.name,vo.description)
                createNewValueSet(vo.name,vs,vo.description)
                $scope.canEdit = true;
            },
            function() {
                //if the user cancels...
            }
        )
    
        
    };

    //create a new ValueSet. If vs is passed in, then use that as the basis...
    function createNewValueSet(id,vs,description) {

        console.log(vs)
        if (vs) {
            //passing in a copy of the ValueSet to copy...
            $scope.vs = vs;
            $scope.vs.id=id;       //the id of the vs on the terminology server
            $scope.vs.name = id;
            $scope.vs.compose.include.forEach(function(inc){
                if (inc.concept) {
                    $scope.includeElement = inc;
                } else if (inc.filter) {
                    $scope.includeElementForFilter = inc;
                }
            });

            //establish the separate variables that reference the include.concept and include.filter
            $scope.includeElement =  $scope.includeElement || {system:'http://snomed.info/sct',concept:[]};
            $scope.includeElementForFilter = $scope.includeElementForFilter || {system:'http://snomed.info/sct',filter:[]};


        } else {
            //a new ValueSet
            $scope.vs = {resourceType : "ValueSet", status:'draft', id: id,compose:{include:[]}};
            $scope.vs.name = id;        //so the search will work on id
            $scope.vs.description = description || id;
            $scope.url = $scope.serverRoot+ "ValueSet/" + id;//  $scope.valueSetRoot+id;
            $scope.vs.compose = {include : []};     //can have multiple includes



            //establish the separate variables that reference the include.concept and include.filter
            $scope.includeElement = {system:'http://snomed.info/sct',concept:[]};
            $scope.includeElementForFilter = {system:'http://snomed.info/sct',filter:[]};


        }

        //the contact must include clinfhir to allow editing...
        $scope.vs.contact = $scope.vs.contact || [];
        $scope.vs.contact.push({name : 'clinfhir'})

    }

    //remove an 'included' concept
    $scope.removeInclude = function (inx) {

        $scope.includeElement.concept.splice(inx,1);
        $scope.input.isDirty = true;

        /*

        //console.log(conceptToRemove)
        var includeToDelete = -1;
        for (var i=0; i < $scope.vs.compose.include.length; i++) {
            var include = $scope.vs.compose.include[i];
            //console.log(include)
            if (include.concept) {
                for (var j=0; j< include.concept.length; j++){
                    var concept = include.concept[j];

                    //console.log(concept)
                    if (conceptToRemove.code == concept.code) {

                        include.concept.splice(j,1);
                        $scope.input.isDirty = true;
                        if (include.concept.length ==0 ){
                            includeToDelete = i;
                        }
                        break;
                    }
                }

            }

        }

        if (includeToDelete > -1) {
            $scope.includeElement.filter.length = 0;
            $scope.vs.compose.include.splice(includeToDelete,1)
        }
        */
    };

    $scope.removeIsa = function (inx) {
        //console.log(conceptToRemove)
        $scope.vs.compose.include.splice(inx,1);
        if ($scope.vs.compose.include.length == 0) {
            $scope.hasIsa = false;
        }
        $scope.input.isDirty = true;

        /*
        var includeToDelete = -1;

        for (var i=0; i < $scope.vs.compose.include.length; i++) {
            var include = $scope.vs.compose.include[i];
            //console.log(include)
            if (include.filter) {
                for (var j=0; j< include.filter.length; j++){
                    var filter = include.filter[j];

                    //console.log(concept)
                    if (filter.value == filtertToRemove.value) {
                        include.filter.splice(j,1)
                        $scope.input.isDirty = true;
                        if (include.filter.length ==0 ){
                            includeToDelete = i;
                        }
                        break;
                    }
                }

            }

        }

        if (includeToDelete > -1) {
            $scope.includeElementForFilter.filter.length = 0;
            $scope.vs.compose.include.splice(includeToDelete,1)
        }
        */
    };


    //find matching ValueSets based on name
    $scope.search = function(filter){
        $scope.showWaiting = true;
        delete $scope.searchResultBundle;
        delete $scope.message;
        //var url = config.servers.terminology + "ValueSet?name="+filter;

        var url =  $scope.serverRoot+"ValueSet?name="+filter;// $scope.valueSetRoot+"?name="+filter;

        GetDataFromServer.adHocFHIRQuery(url).then(
            function(data){
                $scope.searchResultBundle = data.data;
                if (! data.data || ! data.data.entry || data.data.entry.length == 0) {
                    $scope.message = 'No matching ValueSets found'
                }
            },
            function(err){
                alert(angular.toJson(err))
            }
        ).finally(function(){
            $scope.showWaiting = false;
        })
    };

    //select a ValueSet from the search set...
    $scope.selectVs = function(vs) {
        delete $scope.input.hasSystem;
        delete $scope.input.hasIsa;
        delete $scope.input.hasConcept;
        delete $scope.input.isDirty;
        delete $scope.canEdit;
        delete $scope.input.vspreview;
        delete $scope.expansion;
        delete $scope.queryError;
        delete $scope.message;
        delete $scope.queryUrl;
        delete $scope.includeElement;

        $scope.vs = vs;
        $scope.state='edit';


        //get the details of any 'is-a' codes so we can display the name in th eUI
        if (vs.compose && vs.compose.include) {
            vs.compose.include.forEach(function (inc) {

                //this initializes the separate variables pointing at the concept & filter elements...
                if (inc.concept) {
                    //this is a fixed concept. They're all one a single node in this app...
                    $scope.includeElement = inc;       //this is the single include node that has all the single included concepts
                    $scope.hasConcept = true;   //for the display...
                } else if (inc.filter) {
                   // $scope.hasIsa = true;       //each 'include' with a filter is in a separate include
                   // $scope.includeElementForFilter = inc;
                }

                if (inc.filter) {
                    $scope.hasIsa = true;       //each 'include' with a filter is in a separate include
                    //this is an 'as-is' element
                    inc.filter.forEach(function (filter) {
                        //console.log(filter)
                        //get the description of this concept so we can display it. Assume it's a snomed code for now...
                        if (! $scope.input.conceptCache[filter.value]) {

                            var qry = $scope.serverRoot + 'CodeSystem/$lookup?code='+filter.value+"&system="+inc.system;

                            $scope.queryUrl = qry;
                            resourceCreatorSvc.getLookupForCode("http://snomed.info/sct",filter.value).then(
                                 function(data) {
                                     console.log(data);
                                     if (data.data.parameter) {
                                         var parameter = data.data.parameter;
                                         for (var i=0; i < parameter.length;i++) {
                                             if (parameter[i].name == 'display') {
                                                 $scope.input.conceptCache[filter.value] = parameter[i].valueString;
                                                 console.log(parameter[i].valueString)
                                                 break;
                                             }
                                         }
                                     }


                                     },
                                 function(err) {
                                         $scope.queryError = err.data;  //most likely an oo
                                        //alert(angular.toJson(err));
                                 }
                             )


                        }


                    })
                }

            })

        }

        //these are the 'pointer' variables,,,
        $scope.includeElement =  $scope.includeElement || {system:'http://snomed.info/sct',concept:[]};
        //$scope.includeElementForFilter = $scope.includeElementForFilter || {system:'http://snomed.info/sct',filter:[]};


        if (isAuthoredByClinFhir(vs)){
            $scope.canEdit = true;
        }
    };

    //return to the selected list
    $scope.backToList = function(){
        cleanUp();
       // delete $scope.queryError;
        if ($scope.input.dirty) {
            alert('dirty')
        }

       // delete $scope.vs;
        $scope.state='find';

    };

    //add a new concept to the ValueSet
    $scope.addConcept = function(){

        //$scope.vs.compose.include.push($scope.includeElement);
        //$scope.vs.compose.include.push($scope.includeElementForFilter);

        //right now, there is only a single incude node where we put all these concepts ('cause they're all from snomed at the moment)
        //so if this is the first one, then we add the reference to the resource...
        if ($scope.includeElement.concept.length == 0) {
            $scope.vs.compose.include.push($scope.includeElement);
        }


        $scope.includeElement.concept.push({code:$scope.results.cc.code,display:$scope.results.cc.display})
        $scope.input.isDirty = true;
        $scope.hasConcept = true;
    };

    //add an 'is-a' concept
    $scope.isAConcept = function() {

      //  var isaElement;

        $scope.vs.compose.include.push({system:snomedSystem,filter:[{property:'concept',op:'is-a',value:$scope.results.cc.code}]})

/*
    if ($scope.includeElementForFilter.filter.length == 0) {
        $scope.vs.compose.include.push($scope.includeElementForFilter);
    }

        $scope.includeElementForFilter.filter.push({property:'concept',op:'is-a',value:$scope.results.cc.code})

        */

        $scope.input.isDirty = true;
        $scope.input.hasIsa = true;
        delete $scope.results.cc;       //the name entered into the concept search feild in the included 'codeableconcept.html'


    };


    $scope.expand = function(filter){
            delete $scope.expansion;
            delete $scope.queryError;
            delete $scope.queryUrl;
            $scope.showWaiting = true;
            if (filter){
                //var qry = $scope.valueSetRoot+$scope.vs.id + "/$expand?filter="+filter;
                var qry = $scope.serverRoot+ "ValueSet/"+  $scope.vs.id + "/$expand?filter="+filter;

                $scope.queryUrl = qry;

                GetDataFromServer.adHocFHIRQuery(qry).then(
                    function(data){
                        console.log(data)
                        $scope.expansion = data.data.expansion;
                    },
                    function(err){
                        //alert(angular.toJson(err))
                        $scope.queryError = err.data;
                    }
                ).finally(function(){
                    $scope.showWaiting = false;
                });
            } else {
                //var qry = $scope.valueSetRoot+$scope.vs.id + "/$expand";
                var qry = $scope.serverRoot+"ValueSet/"+$scope.vs.id + "/$expand";
                $scope.queryUrl = qry;
                //var qry = config.servers.terminology + "ValueSet/"+id + "/$expand";

                GetDataFromServer.adHocFHIRQuery(qry).then(
                    function(data) {
                        console.log(data)
                        $scope.expansion = data.data.expansion;
                    },
                    function(err){
                        //alert(angular.toJson(err))

                        $scope.queryError = err.data;


                    }
                ).finally(function(){
                    $scope.showWaiting = false;
                });
            }
        };

    $scope.expandDEP = function(filter){
        delete $scope.expansion;
        delete $scope.queryError;
        $scope.showWaiting = true;
        if (filter){
            GetDataFromServer.getFilteredValueSet($scope.vs.id,filter).then(
                function(data){
                    console.log(data)
                    $scope.expansion = data.expansion;
                },
                function(err){
                    alert(angular.toJson(err))
                }
            ).finally(function(){
                $scope.showWaiting = false;
            });
        } else {
            GetDataFromServer.getExpandedValueSet($scope.vs.id).then(
                function(data) {
                    console.log(data)
                    $scope.expansion = data.expansion;
                },
                function(err){
                    alert(angular.toJson(err))

                    $scope.queryError = err
                    
                    
                }
            ).finally(function(){
                $scope.showWaiting = false;
            });
        }
    };

    $scope.save = function () {
      //  $scope.vs.id = $scope.vsId

       // $scope.vs

        $scope.showWaiting = true;

        SaveDataToServer.saveValueSetToTerminologyServerById($scope.vs.id,$scope.vs).then(
            function (data) {
                console.log(data)
                modalService.showModal({}, {bodyText: 'ValueSet saved'});

                $scope.input.isDirty = false;
            },
            function (err) {
                alert(angular.toJson(err))
            }
        ).finally(function(){
            $scope.showWaiting = false;
        })
    };

    function isAuthoredByClinFhir(vs) {
        var isAuthoredByClinFhir = false;
        if (vs.contact) {
            vs.contact.forEach(function(contact){
                if (contact.name == 'clinfhir') {
                    isAuthoredByClinFhir = true;
                }
            })
        }
        return isAuthoredByClinFhir;
    }

        
        
        
    //=========== most of these functions are copied from resourceCreatorCtrl. Thre are better ways of reuse !....  ==========
    Utilities.getValueSetIdFromRegistry(reference,function(vsDetails) {
            $scope.vsDetails = vsDetails;
        console.log(vsDetails);
        }
    );

    //when the user has selected an entry from the autocomplete...
    $scope.selectCCfromList = function(item,model,label,event){
        //get the full lookup for this code - parents, children etc.
        $scope.results.cc = $scope.results.cc || {};


        $scope.results.cc.system = item.system;
        $scope.results.code = item.code;
        $scope.results.display = $scope.results.cc.display;

        $scope.results.ccDirectCode = item.code;
        $scope.results.ccDirectSystem = item.system;
        $scope.results.ccDirectDisplay = $scope.results.cc.display;

        resourceCreatorSvc.getLookupForCode(item.system,item.code).then(
            function(data) {
                console.log(data);
                $scope.terminologyLookup = resourceCreatorSvc.parseCodeLookupResponse(data.data)
                console.log($scope.terminologyLookup);
            },
            function(err) {
                //this will generally occur when using stu-2 - so ignore...
                alert(angular.toJson(err));
            }
        );

    };

    //--------- code for CodeableConcept lookup
    $scope.vsLookup = function(text,vs) {

        console.log(text,vs)
        if (vs) {
            $scope.showWaiting = true;
            return GetDataFromServer.getFilteredValueSet(vs,text).then(
                function(data,statusCode){
                    if (data.expansion && data.expansion.contains) {
                        var lst = data.expansion.contains;
                        return lst;
                    } else {
                        return [
                            {'display': 'No expansion'}
                        ];
                    }
                }, function(vo){
                    var statusCode = vo.statusCode;
                    var msg = vo.error;


                    alert(msg);

                    return [
                        {'display': ""}
                    ];
                }
            ).finally(function(){
                $scope.showWaiting = false;
            });

        } else {
            return [{'display':'Select the ValueSet to query against'}];
        }
    };

    function setTerminologyLookup(system,code) {
        $scope.showWaiting = true;
        resourceCreatorSvc.getLookupForCode(system,code).then(
            function(data) {
                console.log(data);
                $scope.terminologyLookup = resourceCreatorSvc.parseCodeLookupResponse(data.data)
               // console.log($scope.terminologyLookup);
            },
            function(err) {
                alert(angular.toJson(err));
            }
        ).then(function(){
            $scope.showWaiting = false;
        });
    }

    $scope.selectChildTerm = function(code,display){
        $scope.results.ccDirectDisplay = display;
        $scope.results.ccDirectCode = code;

        $scope.results.cc.code = code;
        $scope.results.cc.display = display;

        console.log($scope.results.cc)
        setTerminologyLookup($scope.results.ccDirectSystem,code)
    }

    //the user selects the parent...
    $scope.selectParentCC = function(parent) {
        $scope.results.ccDirectDisplay = parent.description;
        $scope.results.ccDirectCode = parent.value;
        //look up the relations to this one...
        setTerminologyLookup($scope.results.ccDirectSystem,$scope.results.ccDirectCode)
    };

    //use the terminology operation CodeSystem/$lookup to get details of the code / system when manually entered
    $scope.lookupCode = function(system,code) {


        resourceCreatorSvc.getLookupForCode(system,code).then(
            function(data) {
                console.log(data);
                $scope.lookupResult = data.data;
                $scope.terminologyLookup = resourceCreatorSvc.parseCodeLookupResponse(data.data)
                $scope.results.ccDirectDisplay = $scope.terminologyLookup.display;


                //set results.cc as that will enable the buttons - and will also be the code that is saved
                $scope.results.cc = {code:code,system:system,display:$scope.terminologyLookup.display}
                //$scope.results.cc.code,display:$scope.results.cc.display

                //console.log($scope.terminologyLookup);

            },
            function(err) {
                alert(angular.toJson(err));
            }
        )
    };


});