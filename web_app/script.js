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
		"inputs": [],
		"name": "getAllUsers",
		"outputs": [
		  {
			"internalType": "address[]",
			"name": "",
			"type": "address[]"
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
			"internalType": "uint256",
			"name": "",
			"type": "uint256"
		  }
		],
		"name": "userList",
		"outputs": [
		  {
			"internalType": "address",
			"name": "",
			"type": "address"
		  }
		],
		"stateMutability": "view",
		"type": "function"
	  },
	  {
		"inputs": [
		  {
			"internalType": "address",
			"name": "",
			"type": "address"
		  }
		],
		"name": "users",
		"outputs": [
		  {
			"internalType": "bool",
			"name": "",
			"type": "bool"
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
async function getNeighbors(user) {
    // init empty set for neighbors 
	var neighbors = new Set();
	// get all available users and loop
	var users = await getUsers(); 
	for (let i = 0; i < users.length; i++) { 
		// check if there is an edge connecting passed in user to i-th user 
		var owed = await BlockchainSplitwise.lookup(user.toLowerCase(), users[i]);
		// add if non-zero (thus there is edge)
		if (owed > 0) neighbors.add(users[i]);
	} // return as array 
	return Array.from(neighbors);
}

// TODO: Return a list of all users (creditors or debtors) in the system
async function getUsers() {
    try {
        const users = await BlockchainSplitwise.getAllUsers();
        return users.map((user) => user.toLowerCase());
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
}

// TODO: Get the total amount owed by the user specified by 'user'
async function getTotalOwed(user) {
    let owed = 0;
    const users = await getUsers();
    const signer = provider.getSigner(defaultAccount);

    // Use Promise.all to resolve all lookup calls
    const amounts = await Promise.all(
        users.map(async (otherUser) => {
            return await BlockchainSplitwise.connect(signer).lookup(user.toLowerCase(), otherUser);
        })
    );

    // Sum up all the amounts
    owed = amounts.reduce((total, amount) => total + parseInt(amount, 10), 0);

    return owed;
}
// TODO: Get the last time this user has sent or received an IOU, in seconds since Jan. 1, 1970
async function getLastActive(user) {
    const functionCalls = await getAllFunctionCalls(contractAddress, "add_IOU");
    let lastActiveTime = null;
    for (const call of functionCalls) {
        if (call.from.toLowerCase() === user.toLowerCase() || call.args[0].toLowerCase() === user.toLowerCase()) {
            if (lastActiveTime === null || call.t > lastActiveTime) {
                lastActiveTime = call.t;
            }
        }
    }
    return lastActiveTime;
}

// TODO: add an IOU ('I owe you') to the system
async function add_IOU(creditor, amount) {
    const debtor = provider.getSigner(defaultAccount)._address;
    const path = await doBFS(creditor, debtor, getNeighbors) || [];
    await BlockchainSplitwise.connect(provider.getSigner(defaultAccount)).add_IOU(creditor, amount, path);
}

// =============================================================================
//                              Provided Functions
// =============================================================================
async function getAllFunctionCalls(addressOfContract, functionName) {
    let curBlock = await provider.getBlockNumber();
    const function_calls = [];
    while (curBlock !== GENESIS) {
        const b = await provider.getBlockWithTransactions(curBlock);
        const txns = b.transactions;
        for (const txn of txns) {
            if (txn.to === null || txn.to.toLowerCase() !== addressOfContract.toLowerCase()) continue;
            const func_call = abiDecoder.decodeMethod(txn.data);
            if (func_call && func_call.name === functionName) {
                const timeBlock = await provider.getBlock(curBlock);
                const args = func_call.params.map((x) => x.value);
                function_calls.push({ from: txn.from.toLowerCase(), args, t: timeBlock.timestamp });
            }
        }
        curBlock = b.parentHash;
    }
    return function_calls;
}

async function doBFS(start, end, getNeighbors) {
    const queue = [[start]];
    const visited = new Set([start.toLowerCase()]);
    while (queue.length > 0) {
        const cur = queue.shift();
        const lastNode = cur[cur.length - 1];
        if (lastNode.toLowerCase() === end.toLowerCase()) {
            return cur;
        } else {
            const neighbors = await getNeighbors(lastNode);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.toLowerCase())) {
                    visited.add(neighbor.toLowerCase());
                    queue.push([...cur, neighbor]);
                }
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
	console.log("\nTEST:", "Simplest possible test: only runs one add_IOU; uses all client functions: lookup, getTotalOwed, getUsers, getLastActive");

	let score = 0;
	const accounts = await provider.listAccounts(); // ethers.js provider
	defaultAccount = accounts[0];

	// 1. getUsers initially
	let users = await getUsers();
	score += check("getUsers() initially empty", users.length === 0);

	// 2. getTotalOwed initially
	let owed = await getTotalOwed(accounts[1]);
	score += check("getTotalOwed(1) initially 0", owed === 0);

	// 3. lookup(0,1)
	let lookup_0_1 = await BlockchainSplitwise.lookup(accounts[0], accounts[1]);
	console.log("lookup(0,1) current value", lookup_0_1);
	score += check("lookup(0,1) initially 0", parseInt(lookup_0_1, 10) === 0);

	//4. Call add_IOU
	await add_IOU(accounts[1], 10); // This function should wrap contract call and set last active

	// 5. Check getUsers again
	users = await getUsers();
	console.log("has length %d", users.length);
	score += check("getUsers() now length 2", users.length === 2);

	// 6. getTotalOwed(0)
	owed = await getTotalOwed(accounts[0]);
	score += check("getTotalOwed(0) now 10", owed === 10);

	// 7. lookup(0,1)
	lookup_0_1 = await BlockchainSplitwise.lookup(accounts[0], accounts[1]);
	score += check("lookup(0,1) now 10", parseInt(lookup_0_1, 10) === 10);

	// 8. getLastActive(0)
	const timeLastActive = await getLastActive(accounts[0]);
	const timeNow = Date.now() / 1000;
	const difference = timeNow - timeLastActive;
	score += check("getLastActive(0) works", difference <= 60 && difference >= -3); // -3 to 60 sec window

	console.log("Final Score:", score, "/21");
}


//sanityCheck() //Uncomment this line to run the sanity check when you first open index.html