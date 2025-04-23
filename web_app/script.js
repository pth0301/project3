// =============================================================================
//                                  Config
// =============================================================================
// build the client: ethers - main object from ethers.js - which provides tools for interacting with the Etherum blockchain including creating providers, wallets, contracts, and utilities for encoding/decoding data
const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545"); // Connects to local Ethereum node running at http://localhost:8545
var defaultAccount;

// Constant we use later - the genesis block hash (used in block traversal)
var GENESIS = '0x0000000000000000000000000000000000000000000000000000000000000000';

// This is the ABI for your contract (get it from Remix, in the 'Compile' tab)
// ============================================================
var abi = [
	{
		"inputs": [
		  {
			"internalType": "address",
			"name": "creditor",
			"type": "address"
		  },
		  {
			"internalType": "uint32",
			"name": "amount",
			"type": "uint32"
		  },
		  {
			"internalType": "address[]",
			"name": "cycle_path",
			"type": "address[]"
		  }
		],
		"name": "add_IOU",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "",
			"type": "address"
		  },
		  {
			"internalType": "address",
			"name": "",
			"type": "address"
		  }
		],
		"name": "debts",
		"outputs": [
		  {
			"internalType": "uint32",
			"name": "",
			"type": "uint32"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "debtor",
			"type": "address"
		  },
		  {
			"internalType": "address",
			"name": "creditor",
			"type": "address"
		  }
		],
		"name": "lookup",
		"outputs": [
		  {
			"internalType": "uint32",
			"name": "ret",
			"type": "uint32"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	}
]; // FIXME: fill this in with your contract's ABI //Be sure to only have one array, not two
// ============================================================
abiDecoder.addABI(abi);
// call abiDecoder.decodeMethod to use this - see 'getAllFunctionCalls' for more

var contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // FIXME: fill this in with your true contract's address/hash

var BlockchainSplitwise = new ethers.Contract(contractAddress, abi, provider.getSigner()); // BlockchainSplitwise - an instance ofthe smart contract created using ethers.Contract 
// provider.getSigner() - send transactions to the blockchain

// =============================================================================
//                            Functions To Implement
// =============================================================================

// TODO: Add any helper functions here!
async function getNeighbors(user){
	// Retrieve all function calls to the "add_IOU" function
	const functionCalls = await getAllFunctionCalls(contractAddress, "add_IOU");

	// Initialize a Set to store unique neighbors
	const neighbors = new Set();

	// Iterate through the function calls
	for (let call of functionCalls){
		// Check if the user is the debtor (sender)
		if (call.from.toLowerCase() === user.toLowerCase()) {
			// Add the recipient (creditor) to the Set
			neighbors.add(call.args[0].toLowerCase());
		}
	}
	// a "neighbor" is defined as any user who has received an IOU from the given user
	return Array.from(neighbors);
}
// TODO: Return a list of all users (creditors or debtors) in the system
// All users in the system are everyone who has ever sent or received an IOU
async function getUsers() {
	// Retrive all function calls to the "add_IOU" function or retrives all transactions that called the add_IOU function on the smart contract
	const functionCalls = await getAllFunctionCalls(contractAddress, "add_IOU");

	// Use a Set to store unique users
	const users = new Set();

	// Iterate through the function calls
	for (let call of functionCalls){
		// Add the sender (debtor) to the Set
		users.add(call.from.toLowerCase());

		// Add the recipient (creditor) to the Set
		users.add(call.args[0].toLowerCase());

	}
	// Convert the Set to an array and return it
	return Array.from(users);
}

// TODO: Get the total amount owed by the user specified by 'user'
async function getTotalOwed(user) {
	// Retrieve all function calls to the "add_IOU" function
	const functionCalls = await getAllFunctionCalls(contractAddress, "add_IOU");

	// Initialize a variable to store the total amount owed
	let totalOwed = 0;

	// Iterate through the function calls
	for (let call of functionCalls){
		// Check if the user is the debtor (sender)
		if (call.from.toLowerCase() === user.toLowerCase()) {
			totalOwed += parseInt(call.args[1]); 
		}
	}
	return totalOwed;
}

// TODO: Get the last time this user has sent or received an IOU, in seconds since Jan. 1, 1970
// Return null if you can't find any activity for the user.
// HINT: Try looking at the way 'getAllFunctionCalls' is written. You can modify it if you'd like.
async function getLastActive(user) {
	// Retrieve all function calls to the "add_IOU" function
	const functionCalls = await getAllFunctionCalls(contractAddress, "add_IOU");

	// Initialize a variable to store the last active time
	let lastActiveTime = null;

	// Iterate through the function calls
	for (let call of functionCalls){
		// Check if the user is involved in the transaction
		if (call.from.toLowerCase() === user.toLowerCase() || call.args[0].toLowerCase() === user.toLowerCase()) {
			// Update the last active time if it's more recent
			if (lastActiveTime === null || call.t > lastActiveTime) {
				lastActiveTime = call.t;
			}
		}
	}
	return lastActiveTime;
}

// TODO: add an IOU ('I owe you') to the system
// The person you owe money is passed as 'creditor'
// The amount you owe them is passed as 'amount'
async function add_IOU(creditor, amount) {

	// get signer (aka debtor in this case)
	var debtor = provider.getSigner(defaultAccount);
	debtor = debtor._address; 
	// check for path from creditor to debtor (as this would yield a cycle)
	var path = await doBFS(creditor, debtor, getNeighbors);
	// if no path exists, we can just pass in an empty array 
	if (path == null) {
		path = Array(); 
	}
	await BlockchainSplitwise.connect(provider.getSigner(defaultAccount)).add_IOU(creditor, amount, path);
	
}
// =============================================================================
//                              Provided Functions
// =============================================================================
// Reading and understanding these should help you implement the above

// This searches the block history for all calls to 'functionName' (string) on the 'addressOfContract' (string) contract
// It returns an array of objects, one for each call, containing the sender ('from'), arguments ('args'), and the timestamp ('t')
async function getAllFunctionCalls(addressOfContract, functionName) {
	var curBlock = await provider.getBlockNumber(); // fetch the current block number 
	var function_calls = []; // store the details of blocks -  contains sender (from), arguments (args) and the timestamp (t)

	while (curBlock !== GENESIS) { // iterates through the blockchain, starting from the lastest block + moving backward to the genesis block
	  var b = await provider.getBlockWithTransactions(curBlock); // fetch all transactions in the current block
	  var txns = b.transactions;
	  for (var j = 0; j < txns.length; j++) {
	  	var txn = txns[j];

	  	// check that destination of txn is our contract
			if(txn.to == null){continue;} // filter transactions that are sent to the target smart contract 
	  	if (txn.to.toLowerCase() === addressOfContract.toLowerCase()) {
	  		var func_call = abiDecoder.decodeMethod(txn.data); // to identify the function being called and its arguments

				// check that the function getting called in this txn is 'functionName' - check match the function name
				if (func_call && func_call.name === functionName) {
					var timeBlock = await provider.getBlock(curBlock); // fetch the block details
		  		var args = func_call.params.map(function (x) {return x.value});
	  			function_calls.push({
	  				from: txn.from.toLowerCase(), // the address of the sender (debtor), who initiated the transaction
	  				args: args, // the address of creditor and the amount
						t: timeBlock.timestamp // timestamp of the block
	  			})
	  		}
	  	}
	  }
	  curBlock = b.parentHash; // moves to the parent block + repeats the process until it reaches the genesis block
	}
	return function_calls; // contain all matching function calls
}

// find chains of IOUs connecting 2 users + Optimize debt settlement - if a chain of IOUs exists, the DApp could suggest ways to settle debts more effectively by reducing intermediate transactions
// We've provided a breadth-first search implementation for you, if that's useful
// It will find a path from start to end (or return null if none exists), find a pass between 2 nodes
// You just need to pass in a function ('getNeighbors') that takes a node (string) and returns its neighbors (as an array)
async function doBFS(start, end, getNeighbors) { // find a path from start node to end node
	var queue = [[start]];
	while (queue.length > 0) {
		var cur = queue.shift(); // removes the first path from the queue and return the first path
		// check if the last node in the current path is the end node
		var lastNode = cur[cur.length-1]
		if (lastNode.toLowerCase() === end.toString().toLowerCase()) {
			return cur;
		} else {
			var neighbors = await getNeighbors(lastNode);// getNeighbors defines the graph structure by specifying how nodes are connected
			for (var i = 0; i < neighbors.length; i++) {
				queue.push(cur.concat([neighbors[i]]));
			}
		}
	}
	return null;
}

// =============================================================================
//                                      UI
// =============================================================================

// This sets the default account on load and displays the total owed to that
// account.
// UI section is responsible for managing the UI of the DApp -> It interacts with the blockchain through the implemented functions (getTotalOwed, getLastactive, getUsers,...)
// Ensures that the UI is initialized with the correct data for the default account when the DApp is loaded.
provider.listAccounts().then((response)=> {
	console.log(response);
	defaultAccount = response[0]; // sets the default account to the first account in the list

	getTotalOwed(defaultAccount).then((response)=>{ // update getTotalOwed() to calculate the total amount owed by the default account + update the #total_owed elementn in UI
		$("#total_owed").html("$"+response);
	});

	getLastActive(defaultAccount).then((response)=>{
		time = timeConverter(response)
		$("#last_active").html(time)
	});
});

// This code updates the 'My Account' UI with the results of your functions
$("#myaccount").change(function() { // Listens for changes in the #myaccount dropdown menu
	defaultAccount = $(this).val(); // Sets the selected account as the new defaultAccount -> Retrieves the value of the currently selected option in the dropdown menu

	getTotalOwed(defaultAccount).then((response)=>{
		$("#total_owed").html("$"+response);
	})

	getLastActive(defaultAccount).then((response)=>{
		time = timeConverter(response)
		$("#last_active").html(time)
	});
});

// Allows switching between accounts in 'My Account' and the 'fast-copy' in 'Address of person you owe
provider.listAccounts().then((response)=>{
	var opts = response.map(function (a) { return '<option value="'+
			a.toLowerCase()+'">'+a.toLowerCase()+'</option>' }); // each account (a) -> creates an HTML <option> element 
	$(".account").html(opts);
	$(".wallet_addresses").html(response.map(function (a) { return '<li>'+a.toLowerCase()+'</li>' }));
});

// This code updates the 'Users' list in the UI with the results of your function
getUsers().then((response)=>{
	$("#all_users").html(response.map(function (u,i) { return "<li>"+u+"</li>" }));
});

// This runs the 'add_IOU' function when you click the button
// It passes the values from the two inputs above
$("#addiou").click(function() {
	defaultAccount = $("#myaccount").val(); //sets the default account
  add_IOU($("#creditor").val(), $("#amount").val()).then((response)=>{
		window.location.reload(false); // refreshes the page after add_IOU returns and the promise is unwrapped
	})
});

// This is a log function, provided if you want to display things to the page instead of the JavaScript console
// Pass in a discription of what you're printing, and then the object to print
function log(description, obj) {
	$("#log").html($("#log").html() + description + ": " + JSON.stringify(obj, null, 2) + "\n\n");
}


// =============================================================================
//                                      TESTING
// =============================================================================

// This section contains a sanity check test that you can use to ensure your code
// works. We will be testing your code this way, so make sure you at least pass
// the given test. You are encouraged to write more tests!

// Remember: the tests will assume that each of the four client functions are
// async functions and thus will return a promise. Make sure you understand what this means.

function check(name, condition) { // a helper function that evaluates a test condition and logs whether the test passed or failed
	if (condition) { // is true
		console.log(name + ": SUCCESS");
		return 3;
	} else {
		console.log(name + ": FAILED");
		return 0;
	}
}

// The main testing function that runs a series of tests to validate the DApp's functionality
async function sanityCheck() {
	console.log ("\nTEST", "Simplest possible test: only runs one add_IOU; uses all client functions: lookup, getTotalOwed, getUsers, getLastActive");

	var score = 0;

	var accounts = await provider.listAccounts();
	defaultAccount = accounts[0];

	var users = await getUsers(); // ensure that the list of users is empty at the start
	score += check("getUsers() initially empty", users.length === 0);

	var owed = await getTotalOwed(accounts[1]); //ensure that the total owed amount for a user is 0 before any IOUs are added
	score += check("getTotalOwed(0) initially empty", owed === 0);

	var lookup_0_1 = await BlockchainSplitwise.lookup(accounts[0], accounts[1]);
	console.log("lookup(0, 1) current value" + lookup_0_1);
	score += check("lookup(0,1) initially 0", parseInt(lookup_0_1, 10) === 0);

	var response = await add_IOU(accounts[1], "10"); // ass an IOU of 10 from acocunts[0] to accounts[1]

	users = await getUsers();// ensure that the list of users now contains 2 users (one debtor and one creditor) after adding an IOU
	score += check("getUsers() now length 2", users.length === 2);

	owed = await getTotalOwed(accounts[0]); // Ensures that the total owed amount for accounts[0] is 10 now
	score += check("getTotalOwed(0) now 10", owed === 10);

	lookup_0_1 = await BlockchainSplitwise.lookup(accounts[0], accounts[1]);
	score += check("lookup(0,1) now 10", parseInt(lookup_0_1, 10) === 10);

	// ensures that the last active time for accounts[0] is within the last 60 seconds
	var timeLastActive = await getLastActive(accounts[0]);
	var timeNow = Date.now()/1000;
	var difference = timeNow - timeLastActive;
	score += check("getLastActive(0) works", difference <= 60 && difference >= -3); // -3 to 60 seconds

	console.log("Final Score: " + score +"/21");
}

sanityCheck() //Uncomment this line to run the sanity check when you first open index.html
